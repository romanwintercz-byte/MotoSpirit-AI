
import React, { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { resizeImage } from '../utils';

const CameraCaptureModal: React.FC<{
    onCapture: (dataUrl: string) => void;
    onClose: () => void;
}> = ({ onCapture, onClose }) => {
    const { t } = useTranslation();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        let stream: MediaStream | null = null;
        const enableCamera = async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (err) {
                console.error("Error accessing camera: ", err);
                alert(t('cameraError'));
                onClose();
            }
        };
        enableCamera();

        return () => {
            stream?.getTracks().forEach(track => track.stop());
        };
    }, [t, onClose]);
    
    const handleCapture = async () => {
        if (videoRef.current && canvasRef.current) {
            const context = canvasRef.current.getContext('2d');
            if (context) {
                const { videoWidth, videoHeight } = videoRef.current;
                canvasRef.current.width = videoWidth;
                canvasRef.current.height = videoHeight;
                context.drawImage(videoRef.current, 0, 0, videoWidth, videoHeight);
                const rawDataUrl = canvasRef.current.toDataURL('image/jpeg');
                
                // Resize and compress before sending back
                const processedDataUrl = await resizeImage(rawDataUrl, 320);
                onCapture(processedDataUrl);
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-[--color-surface] rounded-2xl shadow-2xl p-6 w-full max-w-lg text-center" onClick={e => e.stopPropagation()}>
                <div className="relative overflow-hidden rounded-lg mb-4 aspect-square bg-black">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover"></video>
                </div>
                <canvas ref={canvasRef} className="hidden"></canvas>
                <div className="flex gap-4">
                    <button onClick={onClose} className="flex-1 bg-[--color-surface-light] text-[--color-text-primary] font-bold py-3 px-6 rounded-lg transition-colors">
                        {t('cancel')}
                    </button>
                    <button onClick={handleCapture} className="flex-[2] bg-[--color-primary] hover:bg-[--color-primary-hover] text-white font-bold py-3 px-6 rounded-lg shadow-md transition-colors">
                        {t('takePhoto')}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default CameraCaptureModal;

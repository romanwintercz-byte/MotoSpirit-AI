
// This local file shadows the 'i18next' package in some environments. 
// We must re-export the package's content to ensure that files like i18n.ts 
// can correctly access the i18next library when they resolve to this file.

// Fix: Use an explicit package index path to avoid circular definition of 'i18next'
// caused by the file having the same name as the library.
export { default } from 'i18next/index';
export * from 'i18next/index';

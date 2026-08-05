const fs = require('fs');
let code = fs.readFileSync('pages/TripPlanner.tsx', 'utf8');

const badButtons = `                          <div className="flex justify-end gap-3">
                            <button 
                              onClick={() => { setEditingDayIdx(null); setEditDayData(null); }}
                              className="px-6 py-3 rounded-xl border border-slate-600 hover:bg-slate-700 text-white font-bold text-sm uppercase tracking-widest transition-colors"
                            >
                              Zrušit
                            </button>
                            <button 
                              onClick={saveDayEdit}
                              className="px-6 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-900/20 font-bold text-sm uppercase tracking-widest transition-colors"
                            >
                              Uložit změny
                            </button>
                          </div>`;

const goodButtons = `                          <div className="flex justify-between items-center">
                            <button 
                              onClick={() => deleteDay(idx)}
                              className="px-6 py-3 rounded-xl border border-red-900/50 hover:bg-red-900/30 text-red-500 font-bold text-sm uppercase tracking-widest transition-colors flex items-center gap-2"
                            >
                              <i className="fas fa-trash"></i> Smazat den
                            </button>
                            <div className="flex gap-3">
                              <button 
                                onClick={() => { setEditingDayIdx(null); setEditDayData(null); }}
                                className="px-6 py-3 rounded-xl border border-slate-600 hover:bg-slate-700 text-white font-bold text-sm uppercase tracking-widest transition-colors"
                              >
                                Zrušit
                              </button>
                              <button 
                                onClick={saveDayEdit}
                                className="px-6 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-900/20 font-bold text-sm uppercase tracking-widest transition-colors"
                              >
                                Uložit změny
                              </button>
                            </div>
                          </div>`;

code = code.replace(badButtons, goodButtons);

const badEndLoop = `                    )
                  )
                })}
                </div>
              </div>`;

const goodEndLoop = `                    )
                  )
                })}
                </div>
                {/* Add new day button */}
                <div className="mt-8 flex justify-center">
                  <button onClick={addNewDay} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl text-white font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-colors">
                    <i className="fas fa-plus"></i> Přidat další den
                  </button>
                </div>
              </div>`;

code = code.replace(badEndLoop, goodEndLoop);

fs.writeFileSync('pages/TripPlanner.tsx', code, 'utf8');
console.log('Fixed buttons');

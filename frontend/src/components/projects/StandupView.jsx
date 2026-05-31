import { useEffect, useState, useCallback } from 'react';
import { projectsAPI } from '../../services/projectsAPI';
import { toast } from 'sonner';
import { Users, Plus, Trash2, Check, ChevronLeft, ChevronRight, Send } from 'lucide-react';

const DOW = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

export default function StandupView({ projectId, isManager }) {
  const [data,      setData]      = useState({ questions: [], answers: [], date: '' });
  const [history,   setHistory]   = useState([]);
  const [tab,       setTab]       = useState('today');
  const [newQ,      setNewQ]      = useState('');
  const [answers,   setAnswers]   = useState({});
  const [sending,   setSending]   = useState({});

  const load = useCallback(() =>
    projectsAPI.getStandup(projectId).then(r => {
      setData(r.data);
      const init = {};
      r.data.questions.forEach(q => { init[q.id] = q.my_answer || ''; });
      setAnswers(init);
    }).catch(() => {})
  , [projectId]);

  const loadHistory = useCallback(() =>
    projectsAPI.getStandupHistory(projectId, 7).then(r => setHistory(r.data)).catch(() => {})
  , [projectId]);

  useEffect(() => { load(); loadHistory(); }, [load, loadHistory]);

  const createQ = async () => {
    if (!newQ.trim()) return;
    try { await projectsAPI.createStandupQ(projectId, { question: newQ, schedule: 'daily' }); toast.success('Pregunta agregada'); setNewQ(''); load(); }
    catch { toast.error('Error al agregar pregunta'); }
  };

  const answer = async (qId) => {
    setSending(p => ({ ...p, [qId]: true }));
    try { await projectsAPI.answerStandup(qId, answers[qId]); toast.success('Respuesta guardada'); load(); }
    catch { toast.error('Error al guardar respuesta'); }
    finally { setSending(p => ({ ...p, [qId]: false })); }
  };

  // Group history by date
  const byDate = history.reduce((acc, h) => {
    if (!acc[h.answer_date]) acc[h.answer_date] = {};
    if (!acc[h.answer_date][h.user_name]) acc[h.answer_date][h.user_name] = [];
    acc[h.answer_date][h.user_name].push(h);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-3">
        {['today','history','manage'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${tab === t ? 'bg-indigo-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
            {t === 'today' ? 'Hoy' : t === 'history' ? 'Historial' : 'Gestionar'}
          </button>
        ))}
      </div>

      {tab === 'today' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">Standup del <strong>{data.date}</strong></p>
          {data.questions.length === 0 ? (
            <div className="text-center py-12 text-slate-400"><Users size={36} className="mx-auto mb-3 opacity-30"/><p>Sin preguntas configuradas.</p>{isManager && <p className="text-xs mt-1">Ve a "Gestionar" para agregar preguntas.</p>}</div>
          ) : (
            <div className="space-y-4">
              {data.questions.map(q => (
                <div key={q.id} className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">{q.question}</p>
                  <div className="flex gap-2">
                    <textarea value={answers[q.id] || ''} onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))} rows={2} placeholder="Tu respuesta…"
                      className="flex-1 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                    <button onClick={() => answer(q.id)} disabled={sending[q.id] || !answers[q.id]?.trim()}
                      className="self-end p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50 transition-colors flex-shrink-0">
                      <Send size={14}/>
                    </button>
                  </div>
                  {q.my_answer && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1.5 flex items-center gap-1"><Check size={11}/> Respondida</p>}
                </div>
              ))}
            </div>
          )}

          {/* Today's answers from team */}
          {data.answers.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Respuestas del equipo hoy</p>
              <div className="space-y-3">
                {Object.entries(data.answers.reduce((acc, a) => { if (!acc[a.user_name]) acc[a.user_name] = []; acc[a.user_name].push(a); return acc; }, {})).map(([user, ans]) => (
                  <div key={user}>
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">@{ans[0]?.username || user}</p>
                    {ans.map(a => <p key={a.id} className="text-sm text-slate-600 dark:text-slate-400 ml-2">· {a.answer}</p>)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-4">
          {Object.keys(byDate).length === 0 ? <p className="text-center py-12 text-slate-400">Sin historial aún.</p> :
          Object.entries(byDate).sort(([a],[b]) => b.localeCompare(a)).map(([date, users]) => (
            <div key={date} className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">{date}</p>
              {Object.entries(users).map(([user, answers]) => (
                <div key={user} className="mb-2">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{user}</p>
                  {answers.map(a => <p key={a.id} className="text-xs text-slate-500 dark:text-slate-400 ml-2 mt-0.5">· <em>{a.question}:</em> {a.answer}</p>)}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {tab === 'manage' && isManager && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm space-y-3">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Agregar pregunta</p>
            <div className="flex gap-2">
              <input value={newQ} onChange={e => setNewQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && createQ()} placeholder="¿En qué trabajaste ayer?" className="flex-1 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
              <button onClick={createQ} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg flex items-center gap-1 transition-colors"><Plus size={14}/> Agregar</button>
            </div>
          </div>
          <div className="space-y-2">
            {data.questions.map(q => (
              <div key={q.id} className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-lg px-4 py-3 shadow-sm">
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${q.schedule === 'daily' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>{q.schedule === 'daily' ? 'Diario' : `${DOW[q.day_of_week]}`}</span>
                <p className="flex-1 text-sm text-slate-700 dark:text-slate-200">{q.question}</p>
                <button onClick={async () => { await projectsAPI.deleteStandupQ(q.id); load(); }} className="text-slate-400 hover:text-red-500"><Trash2 size={13}/></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

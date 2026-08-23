import { useState, useEffect, useRef } from 'react';
import { MessageSquareCode, Send, X, ArrowDown, Sparkles, User, RefreshCw, Star } from 'lucide-react';
import { api } from '../lib/api.js';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
}

interface GeminiChatAssistantProps {
  onNavigate: (tab: string, arg?: any) => void;
}

const quickQuestions = [
  'ما هو أفضل تلفزيون متاح للألعاب؟',
  'أريد ثلاجة موفرة للكهرباء ومساحتها كبيرة',
  'ما هي تكلفة الشحن ومدة التوصيل لديكم؟',
  'هل المنتجات أصلية؟ وكيف أحصل على الضمان؟'
];

export default function GeminiChatAssistant({ onNavigate }: GeminiChatAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      text: 'أهلاً بك يا فندم! أنا مساعدك الذكي لمبيعات الأجهزة المنزلية والإلكترونيات المدعوم بالكامل بنموذج الذكاء الاصطناعي **Gemini** 🧠.\n\nكيف يمكنني مساعدتك اليوم في اختيار أفضل الشاشات، الثلاجات، الغسالات، أو تكييفات كاريير؟ اسألني عن أي جهاز أو تفاصيل التوصيل والضمان!'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom of chat
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: textToSend
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Structure state history into expected API schema
      const historyPayload = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const res = await api.askAssistant(textToSend, historyPayload);

      setMessages(prev => [...prev, {
        id: `g-${Date.now()}`,
        role: 'model',
        text: res.response
      }]);
    } catch (err: any) {
      console.error(err);
      setMessages(prev => [...prev, {
        id: `g-${Date.now()}`,
        role: 'model',
        text: 'عذراً يا فندم، واجهت مشكلة صغيرة في الاتصال بالمخدم الذكي. لكن يسعدني إخبارك أننا نوفر الدفع عند الاستلام بضمان معتمد وشحن سريع 50 جنيهاً مصرياً فقط لجميع المحافظات! هل تود الاستفسار عن شاشات LG OLED أو ثلاجات سامسونج الإنفرتر؟'
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 font-sans" id="floating-chat-container">
      {/* 1. Floating circular launch button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        id="floating-chat-trigger"
        className={`p-4 rounded-full bg-slate-950 hover:bg-amber-500 text-amber-500 hover:text-slate-950 shadow-2xl transition-all duration-300 flex items-center justify-center border border-amber-500/30 scale-100 hover:scale-110 active:scale-95 cursor-pointer relative ${isOpen ? 'rotate-90 bg-rose-600 text-white border-none' : ''}`}
        aria-label="مساعد التسوق الذكي"
      >
        {isOpen ? <X className="w-6 h-6 text-white" /> : <MessageSquareCode className="w-6.5 h-6.5 animate-pulse" />}
        {!isOpen && (
          <span className="absolute -top-1 -left-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
          </span>
        )}
      </button>

      {/* 2. Floating Conversation Box Window */}
      {isOpen && (
        <div className="absolute bottom-20 right-0 w-[350px] sm:w-[420px] max-w-[90vw] h-[550px] max-h-[80vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col justify-between overflow-hidden z-50 animate-in fade-in-50 slide-in-from-bottom-5 duration-300">
          
          {/* Header */}
          <div className="p-4 bg-slate-950 text-white flex justify-between items-center border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Sparkles className="w-5 h-5 text-amber-400 animate-spin-slow" />
              </div>
              <div className="text-right">
                <h3 className="text-xs font-black text-white flex items-center gap-1.5">
                  خبير المبيعات الآلي الذكي
                  <span className="text-[8px] font-bold bg-amber-500 text-slate-950 px-1 py-0.2 rounded font-mono">Gemini</span>
                </h3>
                <p className="text-[10px] text-slate-400">متصل الآن ومستعد لمساعدتك بالمنزل العصري 🌟</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4 text-slate-400 hover:text-white" />
            </button>
          </div>

          {/* Messages History List container */}
          <div className="flex-1 overflow-y-auto p-4 bg-slate-950/70 space-y-4">
            {messages.map((m) => {
              const isAi = m.role === 'model';
              return (
                <div
                  key={m.id}
                  className={`flex gap-2 max-w-[85%] ${isAi ? 'mr-0 ml-auto flex-row' : 'mr-auto ml-0 flex-row-reverse'}`}
                >
                  {/* Icon Avatar */}
                  <div className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center border text-[10px] font-bold ${isAi ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-slate-800 border-slate-700 text-white'}`}>
                    {isAi ? <Sparkles className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                  </div>

                  {/* Bubble text */}
                  <div className={`p-3 rounded-2xl text-xs leading-relaxed ${isAi ? 'bg-slate-900 text-slate-200 border border-slate-800 shadow-xs' : 'bg-amber-500 text-slate-950 font-bold'}`}>
                    {/* Render basic custom paragraph breaks with bolding since markdown library may be heavy */}
                    {m.text.split('\n\n').map((paragraph, pIdx) => (
                      <p key={pIdx} className={pIdx > 0 ? 'mt-2' : ''}>
                        {paragraph.split('**').map((chunk, cIdx) => 
                          cIdx % 2 === 1 ? <strong key={cIdx} className={isAi ? "text-amber-400 font-extrabold" : "text-black font-black"}>{chunk}</strong> : chunk
                        )}
                      </p>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Waiting loader skeleton */}
            {loading && (
              <div className="flex gap-2 max-w-[80%] mr-0 ml-auto">
                <div className="w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                </div>
                <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl flex items-center gap-1.5 shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce delay-100"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce delay-200"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce delay-300"></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Questions chips and input field footer */}
          <div className="p-3 border-t border-slate-800 bg-slate-900">
            {/* Suggestions list chips */}
            {messages.length === 1 && (
              <div className="mb-3.5 flex flex-wrap gap-1.5">
                {quickQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(q)}
                    className="text-[10px] text-right font-bold text-slate-300 bg-slate-950 border border-slate-800 hover:bg-amber-500/10 hover:border-amber-500/30 hover:text-amber-300 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer truncate max-w-full"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Form submit */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend(input);
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                placeholder="اسألني أي شيء عن شاشات، غسالات، أسعار التوصيل..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors disabled:opacity-40 disabled:hover:bg-amber-500 cursor-pointer"
                aria-label="إرسال"
              >
                <Send className="w-4 h-4 transform rotate-180" />
              </button>
            </form>
          </div>

        </div>
      )}
    </div>
  );
}

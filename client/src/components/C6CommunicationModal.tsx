import React, { useEffect, useState } from 'react';
import { X, ExternalLink } from 'lucide-react';

interface C6CommunicationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const C6CommunicationModal: React.FC<C6CommunicationModalProps> = ({ isOpen, onClose }) => {
  const [show, setShow] = useState(false);
  const [render, setRender] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRender(true);
      // Small delay to trigger animation
      const timer = setTimeout(() => setShow(true), 10);
      return () => clearTimeout(timer);
    } else {
      setShow(false);
      const timer = setTimeout(() => setRender(false), 300); // match transition duration
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!render) return null;

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 transition-all duration-300 ${
        show ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Modal Container */}
      <div 
        className={`relative w-full max-w-2xl bg-[#1A1A1A] rounded-2xl shadow-2xl overflow-hidden flex flex-col transform transition-all duration-300 ease-out border border-white/10 ${
          show ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded bg-[#FACC15] flex items-center justify-center text-black font-bold">
               C6
             </div>
             <h2 id="modal-title" className="text-lg font-bold text-white tracking-tight">Comunicado Importante</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-[#FACC15]"
            aria-label="Fechar modal"
            autoFocus
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
           <div className="flex flex-col items-center justify-center space-y-6 text-center">
             
             <div className="space-y-2 pt-2">
                 <h3 className="text-2xl font-bold text-white">Nova Política de Análise</h3>
                 <p className="text-slate-300 max-w-md mx-auto leading-relaxed text-sm">
                    Atualizamos as nossas condições de segurança. Confira as novas diretrizes do banco para a aprovação rápida.
                 </p>
             </div>

             {/* Placeholder for the document image representing the base64 from the prompt */}
             <div className="w-full relative rounded-xl overflow-hidden border border-white/10 group cursor-pointer bg-[#242424] shadow-inner p-2">
                 <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10 rounded-xl">
                    <span className="text-white font-medium flex items-center gap-2 bg-black/60 px-4 py-2 rounded-full backdrop-blur-md">
                      <ExternalLink size={16} /> Ampliar Documento
                    </span>
                 </div>
                 
                 {/* Visual representation of a document/graphic */}
                 <div className="h-56 w-full bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg flex items-center justify-center relative overflow-hidden">
                    {/* Decorative elements representing a standard C6 graphic */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#FACC15]/5 rounded-full blur-2xl transform translate-x-10 -translate-y-10" />
                    <div className="absolute bottom-0 left-0 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl transform -translate-x-10 translate-y-10" />
                    
                    <div className="w-3/5 h-44 bg-white/5 rounded-lg shadow min-w-[200px] border border-white/10 flex flex-col p-4 gap-3 relative z-0">
                       <div className="flex justify-between items-start">
                           <div className="h-3 w-1/3 bg-white/20 rounded" />
                           <div className="h-8 w-8 rounded bg-white/10" />
                       </div>
                       <div className="h-2 w-full bg-white/10 rounded mt-2" />
                       <div className="h-2 w-5/6 bg-white/10 rounded" />
                       <div className="h-2 w-4/5 bg-white/10 rounded" />
                       
                       <div className="mt-auto flex gap-2">
                         <div className="h-8 flex-1 bg-[#FACC15]/20 rounded border border-[#FACC15]/30" />
                         <div className="h-8 flex-1 bg-white/10 rounded" />
                       </div>
                    </div>
                 </div>
             </div>
           </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-black/20 flex justify-end gap-3 border-t border-white/5">
           <button 
             onClick={onClose}
             className="px-5 py-2.5 rounded-lg font-medium text-slate-300 hover:text-white transition-colors"
           >
             Dispensar
           </button>
           <button 
             onClick={onClose}
             className="px-6 py-2.5 rounded-lg font-bold bg-[#FACC15] text-black hover:bg-[#EAB308] shadow-[0_0_20px_rgba(250,204,21,0.15)] transition-all hover:shadow-[0_0_25px_rgba(250,204,21,0.3)] transform hover:-translate-y-0.5"
           >
             Estou Ciente
           </button>
        </div>
      </div>
    </div>
  );
};

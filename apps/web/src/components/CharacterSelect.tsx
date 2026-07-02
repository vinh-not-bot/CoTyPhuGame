import React from 'react';
import { CHARACTERS } from '../data/characters';

interface CharacterSelectProps {
  selectedCharacterId: string;
  onSelect: (id: string) => void;
  compact?: boolean;
}

export const CharacterSelect: React.FC<CharacterSelectProps> = ({
  selectedCharacterId,
  onSelect,
  compact = false,
}) => {
  if (compact) {
    return (
      <div className="flex gap-2 overflow-x-auto py-2 px-1 max-w-full justify-start md:justify-center">
        {CHARACTERS.map((char) => {
          const isSelected = selectedCharacterId === char.id;
          return (
            <button
              key={char.id}
              type="button"
              onClick={() => onSelect(char.id)}
              className={`flex items-center gap-2 p-2 rounded-lg border transition-all duration-300 shrink-0 text-xs text-left
                ${isSelected 
                  ? 'bg-white/15 border-gold-500 shadow-[0_0_12px_rgba(220,182,37,0.4)] scale-105' 
                  : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                }`}
              style={{ '--glow-color': char.color } as React.CSSProperties}
            >
              <img
                src={char.avatarUrl}
                alt={char.name}
                className="w-8 h-8 rounded-full border border-white/20 object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                  const sibling = (e.target as HTMLElement).nextElementSibling;
                  if (sibling) (sibling as HTMLElement).style.display = 'flex';
                }}
              />
              <div 
                className="hidden w-8 h-8 rounded-full border border-white/20 items-center justify-center text-lg bg-slate-800"
                style={{ display: 'none' }}
              >
                {char.emoji}
              </div>
              <div>
                <div className="font-black text-slate-100 flex items-center gap-1">
                  <span>{char.emoji}</span>
                  <span>{char.name}</span>
                </div>
                <div className="text-[9px] text-slate-400 font-bold">{char.title}</div>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-1">
      {CHARACTERS.map((char, index) => {
        const isSelected = selectedCharacterId === char.id;
        return (
          <div
            key={char.id}
            onClick={() => onSelect(char.id)}
            className={`stagger-item glass-panel relative rounded-2xl p-4 cursor-pointer transition-all duration-300 flex flex-col justify-between overflow-hidden group select-none
              ${isSelected 
                ? 'border-2 scale-[1.02] shadow-2xl character-card-glow' 
                : 'border border-white/5 hover:border-white/20 hover:scale-[1.01] hover:bg-white/10'
              }`}
            style={{
              animationDelay: `${index * 60}ms`,
              borderColor: isSelected ? char.color : 'rgba(255, 255, 255, 0.08)',
              '--glow-color': char.color,
            } as React.CSSProperties}
          >
            {/* Background gradient hint */}
            <div 
              className="absolute -top-12 -right-12 w-28 h-28 rounded-full opacity-20 blur-2xl pointer-events-none transition-all duration-500 group-hover:scale-150"
              style={{ background: char.color }}
            />

            <div>
              {/* Avatar and Badge */}
              <div className="flex justify-between items-start mb-3 relative z-10">
                <div className="relative">
                  <img
                    src={char.avatarUrl}
                    alt={char.name}
                    className="w-14 h-14 rounded-full border-2 object-cover shadow-lg"
                    style={{ borderColor: char.color }}
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                      const sibling = (e.target as HTMLElement).nextElementSibling;
                      if (sibling) (sibling as HTMLElement).style.display = 'flex';
                    }}
                  />
                  <div 
                    className="hidden w-14 h-14 rounded-full border-2 items-center justify-center text-3xl bg-slate-800 shadow-lg"
                    style={{ borderColor: char.color, display: 'none' }}
                  >
                    {char.emoji}
                  </div>
                </div>

                {isSelected && (
                  <span className="bg-gold-500 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider shadow animate-pulse">
                    Đã chọn
                  </span>
                )}
              </div>

              {/* Title & Name */}
              <div className="mb-3 relative z-10">
                <span 
                  className="text-[9px] font-extrabold uppercase tracking-widest block"
                  style={{ color: char.color }}
                >
                  {char.title}
                </span>
                <h3 className="text-base font-black text-slate-100 mt-0.5 flex items-center gap-1.5">
                  <span>{char.emoji}</span>
                  <span>{char.name}</span>
                </h3>
              </div>

              {/* Skills */}
              <div className="space-y-2 border-t border-white/5 pt-2 text-[11px] relative z-10">
                {/* Passive */}
                <div className="flex gap-2">
                  <span className="text-sm shrink-0" title="Kỹ năng nội tại (Passive)">
                    {char.passiveIcon}
                  </span>
                  <div>
                    <div className="font-bold text-slate-300 flex items-center gap-1">
                      <span>{char.passiveName}</span>
                      <span className="text-[8px] bg-white/10 px-1 rounded text-slate-400 font-normal">Nội tại</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium leading-tight mt-0.5">
                      {char.passiveDesc}
                    </p>
                  </div>
                </div>

                {/* Active */}
                <div className="flex gap-2">
                  <span className="text-sm shrink-0" title="Kỹ năng chủ động (Active)">
                    {char.activeIcon}
                  </span>
                  <div>
                    <div className="font-bold text-gold-300 flex items-center gap-1">
                      <span>{char.activeName}</span>
                      <span className="text-[8px] bg-gold-500/20 px-1 rounded text-gold-200 font-normal">Kích hoạt</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium leading-tight mt-0.5">
                      {char.activeDesc}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

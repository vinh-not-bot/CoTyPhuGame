import React, { useState } from 'react';
import { getCharacterById } from '../data/characters';

interface SkillButtonProps {
  characterId: string;
  isActiveSkillUsed: boolean;
  onUseActiveSkill: () => void;
  disabled?: boolean;
}

export const SkillButton: React.FC<SkillButtonProps> = ({
  characterId,
  isActiveSkillUsed,
  onUseActiveSkill,
  disabled = false,
}) => {
  const char = getCharacterById(characterId);
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={onUseActiveSkill}
        disabled={isActiveSkillUsed || disabled}
        className={`relative w-12 h-12 rounded-full border-2 flex items-center justify-center text-xl transition-all duration-300 active:scale-95 shadow-lg
          ${isActiveSkillUsed 
            ? 'bg-slate-800/80 border-slate-700 text-slate-500 cursor-not-allowed opacity-50' 
            : disabled 
              ? 'bg-slate-700/50 border-slate-600 text-slate-400 cursor-not-allowed'
              : 'bg-slate-950/90 hover:scale-110 cursor-pointer skill-btn-ready'
          }`}
        style={{
          borderColor: isActiveSkillUsed ? '#475569' : char.color,
          '--skill-color': char.color,
        } as React.CSSProperties}
      >
        <span>{char.emoji}</span>
        
        {/* Overlay showing checkmark if active skill is used */}
        {isActiveSkillUsed && (
          <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center text-[10px] font-black text-slate-400">
            USED
          </div>
        )}
      </button>

      {/* Advanced Skill Tooltip/Popover */}
      {showTooltip && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 w-64 glass-panel-strong rounded-xl p-3 shadow-2xl z-50 animate-fade-in text-xs flex flex-col gap-2 border border-white/10">
          {/* Character Header */}
          <div className="flex items-center gap-2 border-b border-white/10 pb-1.5">
            <img 
              src={char.avatarUrl} 
              alt={char.name} 
              className="w-6 h-6 rounded-full border object-cover"
              style={{ borderColor: char.color }}
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
                const sibling = (e.target as HTMLElement).nextElementSibling;
                if (sibling) (sibling as HTMLElement).style.display = 'flex';
              }}
            />
            <div className="hidden w-6 h-6 rounded-full border items-center justify-center text-xs bg-slate-800" style={{ display: 'none' }}>
              {char.emoji}
            </div>
            <div>
              <div className="font-black text-slate-200">{char.name}</div>
              <div className="text-[9px] text-slate-400 font-bold">{char.title}</div>
            </div>
          </div>

          {/* Passive Skill */}
          <div>
            <div className="font-extrabold text-slate-300 flex items-center gap-1">
              <span>{char.passiveIcon}</span>
              <span>{char.passiveName}</span>
              <span className="text-[8px] bg-white/10 px-1 rounded text-slate-400 font-normal">Nội tại</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5 leading-normal">{char.passiveDesc}</p>
          </div>

          {/* Active Skill */}
          <div className="border-t border-white/5 pt-1.5">
            <div className="font-extrabold text-gold-400 flex items-center gap-1">
              <span>{char.activeIcon}</span>
              <span>{char.activeName}</span>
              <span className="text-[8px] bg-gold-500/20 px-1 rounded text-gold-200 font-normal">Kích hoạt</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5 leading-normal">{char.activeDesc}</p>
            {isActiveSkillUsed && (
              <span className="text-[8px] text-red-400 font-bold block mt-1">⚠️ Kỹ năng kích hoạt đã được sử dụng!</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

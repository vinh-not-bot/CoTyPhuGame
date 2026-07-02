import React, { useState } from 'react';
import { getCharacterById } from '../data/characters';

interface SkillButtonProps {
  characterId: string;
  skillCooldowns: Record<string, number>;
  onCastSkill: (skillId: string, cooldown: number, vfx: 'fist' | 'beam' | 'shield') => void;
  disabled?: boolean;
}

export const SkillButton: React.FC<SkillButtonProps> = ({
  characterId,
  skillCooldowns,
  onCastSkill,
  disabled = false,
}) => {
  const char = getCharacterById(characterId);
  const [hoveredSkillId, setHoveredSkillId] = useState<string | null>(null);

  return (
    <div className="flex gap-2 items-center">
      {char.skills.map((skill) => {
        const cooldown = skillCooldowns[skill.id] || 0;
        const isCooldown = cooldown > 0;
        const isHovered = hoveredSkillId === skill.id;

        return (
          <div key={skill.id} className="relative">
            <button
              type="button"
              onMouseEnter={() => setHoveredSkillId(skill.id)}
              onMouseLeave={() => setHoveredSkillId(null)}
              onClick={() => onCastSkill(skill.id, skill.cooldown, skill.vfx)}
              disabled={isCooldown || disabled}
              className={`relative w-9 h-9 rounded-full border-2 flex items-center justify-center text-base transition-all duration-300 active:scale-95 shadow-md
                ${isCooldown 
                  ? 'bg-slate-800/90 border-slate-700 text-slate-500 cursor-not-allowed opacity-60' 
                  : disabled 
                    ? 'bg-slate-700/50 border-slate-600 text-slate-400 cursor-not-allowed'
                    : 'bg-slate-950/95 hover:scale-115 cursor-pointer skill-btn-ready border-emerald-500'
                }`}
              style={{
                borderColor: isCooldown ? '#475569' : char.color,
                '--skill-color': char.color,
              } as React.CSSProperties}
            >
              <span className="relative z-10">{skill.icon}</span>

              {/* Cooldown Overlay */}
              {isCooldown && (
                <div className="absolute inset-0 bg-black/65 rounded-full flex flex-col items-center justify-center text-[8px] font-black text-amber-500 tracking-tighter">
                  <span>HỒI</span>
                  <span>{cooldown}L</span>
                </div>
              )}
            </button>

            {/* Tooltip detail khi di chuột */}
            {isHovered && (
              <div className="absolute bottom-11 left-1/2 -translate-x-1/2 w-52 glass-panel-strong rounded-xl p-2.5 shadow-2xl z-50 animate-fade-in text-[10px] flex flex-col gap-1.5 border border-white/10">
                <div className="flex justify-between items-center border-b border-white/5 pb-1">
                  <span className="font-black text-gold-400 flex items-center gap-1">
                    <span>{skill.icon}</span>
                    <span>{skill.name}</span>
                  </span>
                  <span className="bg-slate-800 px-1.5 py-0.2 rounded text-[7px] text-slate-400 font-extrabold uppercase">
                    Hồi {skill.cooldown} lượt
                  </span>
                </div>
                <p className="text-slate-300 font-medium leading-normal">{skill.desc}</p>
                <div className="text-[7.5px] text-slate-400 font-bold uppercase tracking-wider">
                  Hiệu ứng 3D: {skill.vfx === 'fist' ? '👊 Thiết Long Quyền' : skill.vfx === 'beam' ? '💫 Tinh Tú Chiêu Tài' : '🛡️ Kết Giới Bảo Hộ'}
                </div>
                {isCooldown && (
                  <span className="text-rose-400 font-black tracking-tight text-[7px]">⚠️ Đang hồi chiêu: Còn {cooldown} lượt nữa!</span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

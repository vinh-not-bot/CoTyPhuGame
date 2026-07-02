import React, { useState, useEffect } from 'react';

interface DiceRollerProps {
  dice: [number, number];
  onRoll: () => void;
  isMyTurn: boolean;
  disabled: boolean;
}

const renderDots = (value: number) => {
  const dotPositions: Record<number, string[]> = {
    1: ['col-start-2 row-start-2'],
    2: ['col-start-1 row-start-1', 'col-start-3 row-start-3'],
    3: ['col-start-1 row-start-1', 'col-start-2 row-start-2', 'col-start-3 row-start-3'],
    4: [
      'col-start-1 row-start-1',
      'col-start-3 row-start-1',
      'col-start-1 row-start-3',
      'col-start-3 row-start-3',
    ],
    5: [
      'col-start-1 row-start-1',
      'col-start-3 row-start-1',
      'col-start-2 row-start-2',
      'col-start-1 row-start-3',
      'col-start-3 row-start-3',
    ],
    6: [
      'col-start-1 row-start-1',
      'col-start-3 row-start-1',
      'col-start-1 row-start-2',
      'col-start-3 row-start-2',
      'col-start-1 row-start-3',
      'col-start-3 row-start-3',
    ],
  };

  const positions = dotPositions[value] || [];

  return (
    <div className="grid grid-cols-3 grid-rows-3 gap-1 w-full h-full p-2 bg-white rounded-xl shadow-inner border border-slate-300">
      {positions.map((pos, idx) => (
        <span key={idx} className={`w-2.5 h-2.5 bg-rose-600 rounded-full ${pos}`} />
      ))}
    </div>
  );
};

// Góc xoay camera tương ứng cho từng mặt của xúc xắc (1-6)
const faceRotations: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },       // Mặt 1 ở trước
  6: { x: 180, y: 0 },     // Mặt 6 ở sau
  3: { x: 0, y: 90 },      // Mặt 3 ở trái
  4: { x: 0, y: -90 },     // Mặt 4 ở phải
  2: { x: -90, y: 0 },     // Mặt 2 ở trên
  5: { x: 90, y: 0 },      // Mặt 5 ở dưới
};

export const DiceRoller: React.FC<DiceRollerProps> = ({ dice, onRoll, isMyTurn, disabled }) => {
  const [rolling, setRolling] = useState(false);
  const [rollAngle1, setRollAngle1] = useState({ x: 0, y: 0, z: 0 });
  const [rollAngle2, setRollAngle2] = useState({ x: 0, y: 0, z: 0 });

  // Đồng bộ góc xoay xúc xắc dựa trên giá trị dice mới
  useEffect(() => {
    if (rolling) return;
    
    const rot1 = faceRotations[dice[0]] || faceRotations[1];
    const rot2 = faceRotations[dice[1]] || faceRotations[1];
    
    setRollAngle1({ x: rot1.x, y: rot1.y, z: 0 });
    setRollAngle2({ x: rot2.x, y: rot2.y, z: 0 });
  }, [dice, rolling]);

  const handleRoll = () => {
    if (disabled || !isMyTurn) return;
    setRolling(true);

    // Tạo hiệu ứng xoay tít mù ngẫu nhiên trong 800ms
    const randomRotations1 = {
      x: Math.floor(Math.random() * 3 + 3) * 360 + (faceRotations[dice[0]]?.x || 0),
      y: Math.floor(Math.random() * 3 + 3) * 360 + (faceRotations[dice[0]]?.y || 0),
      z: Math.floor(Math.random() * 360),
    };
    const randomRotations2 = {
      x: Math.floor(Math.random() * 3 + 3) * -360 + (faceRotations[dice[1]]?.x || 0),
      y: Math.floor(Math.random() * 3 + 3) * -360 + (faceRotations[dice[1]]?.y || 0),
      z: Math.floor(Math.random() * 360),
    };

    setRollAngle1(randomRotations1);
    setRollAngle2(randomRotations2);

    setTimeout(() => {
      setRolling(false);
      onRoll();
    }, 850);
  };

  return (
    <div className="flex flex-col items-center gap-5 select-none relative z-10">
      {/* Container Xúc xắc 3D */}
      <div 
        className="flex gap-10 py-4"
        style={{ perspective: '800px', transformStyle: 'preserve-3d' }}
      >
        {/* Xúc xắc 1 */}
        <div 
          className="relative w-12 h-12 transition-transform duration-[800ms] ease-out"
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateX(${rollAngle1.x}deg) rotateY(${rollAngle1.y}deg) rotateZ(${rollAngle1.z}deg)`,
          }}
        >
          {/* Mặt 1 (Front) */}
          <div className="absolute inset-0" style={{ transform: 'translateZ(24px)', backfaceVisibility: 'hidden' }}>{renderDots(1)}</div>
          {/* Mặt 6 (Back) */}
          <div className="absolute inset-0" style={{ transform: 'rotateY(180deg) translateZ(24px)', backfaceVisibility: 'hidden' }}>{renderDots(6)}</div>
          {/* Mặt 3 (Left) */}
          <div className="absolute inset-0" style={{ transform: 'rotateY(-90deg) translateZ(24px)', backfaceVisibility: 'hidden' }}>{renderDots(3)}</div>
          {/* Mặt 4 (Right) */}
          <div className="absolute inset-0" style={{ transform: 'rotateY(90deg) translateZ(24px)', backfaceVisibility: 'hidden' }}>{renderDots(4)}</div>
          {/* Mặt 2 (Top) */}
          <div className="absolute inset-0" style={{ transform: 'rotateX(90deg) translateZ(24px)', backfaceVisibility: 'hidden' }}>{renderDots(2)}</div>
          {/* Mặt 5 (Bottom) */}
          <div className="absolute inset-0" style={{ transform: 'rotateX(-90deg) translateZ(24px)', backfaceVisibility: 'hidden' }}>{renderDots(5)}</div>
        </div>

        {/* Xúc xắc 2 */}
        <div 
          className="relative w-12 h-12 transition-transform duration-[800ms] ease-out"
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateX(${rollAngle2.x}deg) rotateY(${rollAngle2.y}deg) rotateZ(${rollAngle2.z}deg)`,
          }}
        >
          {/* Mặt 1 (Front) */}
          <div className="absolute inset-0" style={{ transform: 'translateZ(24px)', backfaceVisibility: 'hidden' }}>{renderDots(1)}</div>
          {/* Mặt 6 (Back) */}
          <div className="absolute inset-0" style={{ transform: 'rotateY(180deg) translateZ(24px)', backfaceVisibility: 'hidden' }}>{renderDots(6)}</div>
          {/* Mặt 3 (Left) */}
          <div className="absolute inset-0" style={{ transform: 'rotateY(-90deg) translateZ(24px)', backfaceVisibility: 'hidden' }}>{renderDots(3)}</div>
          {/* Mặt 4 (Right) */}
          <div className="absolute inset-0" style={{ transform: 'rotateY(90deg) translateZ(24px)', backfaceVisibility: 'hidden' }}>{renderDots(4)}</div>
          {/* Mặt 2 (Top) */}
          <div className="absolute inset-0" style={{ transform: 'rotateX(90deg) translateZ(24px)', backfaceVisibility: 'hidden' }}>{renderDots(2)}</div>
          {/* Mặt 5 (Bottom) */}
          <div className="absolute inset-0" style={{ transform: 'rotateX(-90deg) translateZ(24px)', backfaceVisibility: 'hidden' }}>{renderDots(5)}</div>
        </div>
      </div>

      {isMyTurn && (
        <button
          onClick={handleRoll}
          disabled={disabled || rolling}
          className={`px-5 py-2.5 rounded-xl font-black text-white shadow-lg transition-all duration-200 text-xs active:scale-95 cursor-pointer
            ${disabled || rolling
              ? 'bg-slate-500 cursor-not-allowed opacity-50'
              : 'bg-gradient-to-r from-gold-600 to-gold-500 hover:from-gold-500 hover:to-gold-400 btn-pulse-glow hover:scale-102'
            }`}
        >
          {rolling ? 'Đang tung...' : 'Tung Xúc Xắc'}
        </button>
      )}
    </div>
  );
};

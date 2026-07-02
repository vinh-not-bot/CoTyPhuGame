import React from 'react';
import type { Tile as TileType, Player } from '../types';
import { Tile } from './Tile';

interface BoardProps {
  board: TileType[];
  players: Player[];
  onTileClick?: (index: number) => void;
  selectedTileIndex?: number | null;
  selectableTileIndices?: number[];
  children?: React.ReactNode;
}

export const getTileGridPosition = (index: number) => {
  if (index === 0) return { gridRow: 11, gridColumn: 11 };
  if (index > 0 && index < 10) return { gridRow: 11, gridColumn: 11 - index };
  if (index === 10) return { gridRow: 11, gridColumn: 1 };
  if (index > 10 && index < 20) return { gridRow: 11 - (index - 10), gridColumn: 1 };
  if (index === 20) return { gridRow: 1, gridColumn: 1 };
  if (index > 20 && index < 30) return { gridRow: 1, gridColumn: 1 + (index - 20) };
  if (index === 30) return { gridRow: 1, gridColumn: 11 };
  if (index > 30 && index < 40) return { gridRow: 1 + (index - 30), gridColumn: 11 };
  return { gridRow: 1, gridColumn: 1 };
};

export const Board: React.FC<BoardProps> = ({
  board,
  players,
  onTileClick,
  selectedTileIndex,
  selectableTileIndices = [],
  children,
}) => {
  return (
    <div className="relative w-full max-w-[650px] aspect-square bg-[#cbd5e1] border-4 border-slate-300 rounded-3xl p-1 shadow-2xl select-none">
      <div className="grid grid-cols-11 grid-rows-11 gap-0.5 w-full h-full rounded-2xl overflow-hidden bg-slate-200">
        {board.map((tile) => {
          const pos = getTileGridPosition(tile.index);
          const playersOnTile = players.filter((p) => p.position === tile.index && !p.isBankrupt);
          const isSelectable = selectableTileIndices.includes(tile.index);

          return (
            <div
              key={tile.index}
              style={{
                gridRow: pos.gridRow,
                gridColumn: pos.gridColumn,
              }}
            >
              <Tile
                tile={tile}
                playersOnTile={playersOnTile}
                isSelectable={isSelectable || selectedTileIndex === tile.index}
                onClick={() => onTileClick?.(tile.index)}
              />
            </div>
          );
        })}

        {/* Center of the Board */}
        <div className="col-start-2 col-end-11 row-start-2 row-end-11 bg-[#e8f5e9]/95 flex flex-col justify-between p-4 relative z-0 border border-slate-200 rounded-2xl m-0.5 shadow-inner">
          {children}
        </div>
      </div>
    </div>
  );
};

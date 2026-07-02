import React, { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { useRealtimeRoom } from '../hooks/useRealtimeRoom';
import { LobbyRoom } from '../components/LobbyRoom';
import { Board } from '../components/Board';
import { PlayerPanel } from '../components/PlayerPanel';
import { DiceRoller } from '../components/DiceRoller';
import { ActionModal } from '../components/ActionModal';
import { TradeModal } from '../components/TradeModal';
import { GameLog } from '../components/GameLog';
import { ResultModal } from '../components/ResultModal';
import { SkillButton } from '../components/SkillButton';
import { getCharacterById } from '../data/characters';

export const GameRoom: React.FC = () => {
  useRealtimeRoom();

  const {
    userId,
    room,
    players,
    gameState,
    trades,
    loading,
    error,
    setError,
    startGame,
    rollDice,
    buyProperty,
    skipBuy,
    payRent,
    payTax,
    drawCard,
    payJailFine,
    useJailFreeCard,
    proposeTrade,
    acceptTrade,
    rejectTrade,
    declareBankruptcy,
    endTurn,
    buildHouse,
    sellHouse,
    mortgageProperty,
    activeSkillUsed,
    activateActiveSkill,
  } = useGameStore();

  const [showTradeForm, setShowTradeForm] = useState(false);
  const [selectedTileIndex, setSelectedTileIndex] = useState<number | null>(null);

  if (!room) return null;

  const isLobby = room.status === 'WAITING';
  const activePlayerIdx = gameState?.current_turn_index ?? 0;
  const activePlayer = gameState?.players[activePlayerIdx];
  const isMyTurn = activePlayer?.userId === userId;

  // Lấy nhân vật của tôi
  const myPlayerInGame = gameState?.players.find((p) => p.userId === userId);
  const myCharacterId = myPlayerInGame?.characterId || 'huan_hoa_hong';

  const handleLeaveRoom = () => {
    localStorage.removeItem('cotyphu_room_id');
    window.location.reload();
  };

  const handleRestart = () => {
    window.location.reload();
  };

  const handleProposeTrade = async (
    receiverId: string,
    proposerCash: number,
    proposerProps: number[],
    receiverCash: number,
    receiverProps: number[]
  ) => {
    await proposeTrade(receiverId, proposerCash, proposerProps, receiverCash, receiverProps);
  };

  const handleUseSkill = () => {
    const char = getCharacterById(myCharacterId);
    activateActiveSkill();
    alert(`⚡ Đã kích hoạt kỹ năng chủ động "${char.activeName}" của ${char.name}!\nHiệu ứng: ${char.activeDesc}`);
  };

  if (isLobby) {
    const lobbyPlayers = players.map((p) => ({
      userId: p.userId,
      display_name: p.display_name,
      avatar_color: p.avatar_color || '#3b82f6',
      is_host: p.is_host,
      character_id: p.character_id,
    }));

    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#0b1329] text-white">
        <LobbyRoom
          room={room}
          players={lobbyPlayers}
          currentUserId={userId}
          onStartGame={startGame}
          onLeaveRoom={handleLeaveRoom}
        />
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b1329] text-white font-bold text-sm">
        Đang tải dữ liệu bàn cờ...
      </div>
    );
  }

  const selectedTile = selectedTileIndex !== null ? gameState.board[selectedTileIndex] : null;
  const isOwnerOfSelected = selectedTile?.ownerId === userId;
  const hasIncomingTrade = trades.some((t) => t.receiver_id === userId && t.status === 'PENDING');

  const checkMonopoly = (tile: any) => {
    if (tile.type !== 'property' || tile.mortgaged) return false;
    const color = tile.colorGroup;
    const sameColorTiles = gameState.board.filter((t) => t.colorGroup === color);
    return sameColorTiles.every((t) => t.ownerId === userId && !t.mortgaged);
  };

  return (
    <div className="min-h-screen bg-[#0b1329] p-4 text-white flex flex-col md:flex-row items-center justify-center gap-6 select-none">
      <PlayerPanel
        players={gameState.players}
        activePlayerIndex={gameState.current_turn_index}
        currentUserId={userId}
        board={gameState.board}
      />

      <div className="flex flex-col items-center gap-4 relative">
        <button
          onClick={handleLeaveRoom}
          className="absolute -top-10 right-0 px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white rounded text-[10px] font-bold z-10 transition-all"
        >
          Thoát Trận
        </button>

        {error && (
          <div className="absolute -top-10 left-0 bg-red-900/90 border border-red-500 text-red-100 px-3 py-1.5 rounded text-[10px] font-bold z-10 text-center max-w-[280px] shadow-lg">
            {error}
            <button onClick={() => setError(null)} className="ml-2 text-white font-bold">✕</button>
          </div>
        )}

        <Board
          board={gameState.board}
          players={gameState.players}
          selectedTileIndex={selectedTileIndex}
          onTileClick={(idx) => {
            const tile = gameState.board[idx];
            if (tile.ownerId === userId) {
              setSelectedTileIndex(idx);
            } else {
              setSelectedTileIndex(null);
            }
          }}
        >
          {selectedTile && isOwnerOfSelected ? (
            <div className="flex-1 flex flex-col justify-between bg-[#1c2541] border border-gold-500 rounded p-3 text-xs shadow-lg animate-fade-in my-1">
              <div>
                <div className="flex justify-between items-center border-b border-[#3a506b] pb-1 mb-2">
                  <span className="font-bold text-gold-400 uppercase tracking-wider text-[10px]">
                    Quản Lý Bất Động Sản
                  </span>
                  <button
                    onClick={() => setSelectedTileIndex(null)}
                    className="text-slate-400 hover:text-white font-bold"
                  >
                    ✕
                  </button>
                </div>
                <h4 className="text-sm font-bold text-white mb-1">{selectedTile.name}</h4>
                <div className="text-[10px] text-slate-300 flex flex-col gap-1">
                  <div>Loại: <span className="font-semibold">{selectedTile.type === 'property' ? 'Đất Đai' : selectedTile.type === 'railroad' ? 'Nhà Ga' : 'Tiện Ích'}</span></div>
                  {selectedTile.type === 'property' && (
                    <div>Cấp độ: <span className="font-semibold text-green-400">
                      {selectedTile.houses === 5 ? '1 Khách Sạn' : `${selectedTile.houses} Nhà`}
                    </span></div>
                  )}
                  <div>Trạng thái: <span className="font-semibold">{selectedTile.mortgaged ? 'Đang Thế Chấp' : 'Bình Thường'}</span></div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 justify-end mt-2">
                {selectedTile.type === 'property' && checkMonopoly(selectedTile) && (
                  <>
                    <button
                      onClick={() => sellHouse(selectedTile.index)}
                      disabled={selectedTile.houses === 0}
                      className="px-2.5 py-1 bg-red-800 hover:bg-red-900 disabled:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded text-white font-bold text-[10px]"
                    >
                      Bán Nhà (+${selectedTile.housePrice / 2})
                    </button>
                    <button
                      onClick={() => buildHouse(selectedTile.index)}
                      disabled={selectedTile.houses >= 5 || (activePlayer?.cash ?? 0) < selectedTile.housePrice}
                      className="px-2.5 py-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded text-white font-bold text-[10px]"
                    >
                      Xây Nhà (-${selectedTile.housePrice})
                    </button>
                  </>
                )}
                <button
                  onClick={() => mortgageProperty(selectedTile.index)}
                  disabled={selectedTile.type === 'property' && selectedTile.houses > 0}
                  className="px-2.5 py-1 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded text-white font-bold text-[10px]"
                >
                  {selectedTile.mortgaged ? `Giải chấp (-$${Math.floor(selectedTile.price * 0.55)})` : `Thế chấp (+$${selectedTile.price / 2})`}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-between my-1 min-h-[140px]">
              {/* Game Room Header & SkillButton placement */}
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <div className="text-left">
                  <span className="text-[10px] text-gold-500 font-bold uppercase tracking-wider">
                    Trận Đấu Đang Diễn Ra
                  </span>
                  <h2 className="text-sm font-bold text-white mt-0.5">
                    {isMyTurn ? (
                      <span className="text-green-400 animate-pulse">Lượt đi của bạn!</span>
                    ) : (
                      <span>Lượt của: <span className="text-gold-300">{activePlayer?.name}</span></span>
                    )}
                  </h2>
                </div>

                {/* Skill Button for current client */}
                {!isLobby && myPlayerInGame && (
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-slate-400 font-bold">Kỹ năng:</span>
                    <SkillButton
                      characterId={myCharacterId}
                      isActiveSkillUsed={activeSkillUsed}
                      onUseActiveSkill={handleUseSkill}
                      disabled={!isMyTurn || gameState.winner_id !== null}
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center py-2 flex-grow">
                {gameState.turn_phase === 'roll' && (
                  <div className="flex flex-col items-center gap-2">
                    {isMyTurn && activePlayer?.inJail && (
                      <div className="bg-[#0f172a] border border-red-500/50 p-2 rounded text-center mb-1 max-w-[240px]">
                        <p className="text-[9px] text-red-300 font-bold mb-1">BẠN ĐANG Ở TRONG TÙ!</p>
                        <div className="flex gap-1.5 justify-center">
                          <button
                            onClick={payJailFine}
                            disabled={(activePlayer?.cash ?? 0) < 50}
                            className="px-2 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed rounded text-white text-[9px] font-bold"
                          >
                            Nộp phạt $50
                          </button>
                          {activePlayer?.jailFreeCards && activePlayer.jailFreeCards > 0 && (
                            <button
                              onClick={useJailFreeCard}
                              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white text-[9px] font-bold"
                            >
                              Dùng thẻ thoát tù
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    <DiceRoller
                      dice={gameState.last_dice}
                      onRoll={rollDice}
                      isMyTurn={isMyTurn}
                      disabled={loading}
                    />
                  </div>
                )}

                {gameState.turn_phase === 'resolve' && (
                  <ActionModal
                    gameState={gameState}
                    currentUserId={userId}
                    onBuy={buyProperty}
                    onSkipBuy={skipBuy}
                    onPayRent={payRent}
                    onPayTax={payTax}
                    onDrawCard={drawCard}
                    onDeclareBankruptcy={declareBankruptcy}
                  />
                )}

                {(gameState.turn_phase === 'action' || gameState.turn_phase === 'end') && isMyTurn && (
                  <div className="flex flex-col items-center gap-1">
                    <p className="text-[9px] text-slate-400 text-center mb-1 max-w-[260px]">
                      Mẹo: Bạn có thể click vào đất của mình trên bàn cờ để xây nhà hoặc thế chấp.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowTradeForm(true)}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded text-white font-bold text-xs shadow transition-all active:scale-95"
                      >
                        Thương Lượng
                      </button>
                      <button
                        onClick={endTurn}
                        disabled={(activePlayer?.cash ?? 0) < 0}
                        className={`px-5 py-1.5 rounded text-white font-bold text-xs shadow-md transition-all active:scale-95
                          ${(activePlayer?.cash ?? 0) >= 0
                            ? 'bg-green-600 hover:bg-green-700 shadow-[0_0_12px_rgba(22,163,74,0.4)]'
                            : 'bg-slate-600 opacity-50 cursor-not-allowed'
                          }`}
                      >
                        Kết Thúc Lượt
                      </button>
                    </div>
                  </div>
                )}

                {(gameState.turn_phase === 'action' || gameState.turn_phase === 'end') && !isMyTurn && (
                  <div className="text-center py-2 animate-pulse">
                    <p className="text-xs text-slate-300">
                      Đang đợi <span className="font-bold text-white">{activePlayer?.name}</span> thao tác hoặc kết thúc lượt.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <GameLog logs={gameState.log || []} />
        </Board>
      </div>

      {(showTradeForm || hasIncomingTrade) && (
        <TradeModal
          gameState={gameState}
          currentUserId={userId}
          activeTrades={trades}
          onPropose={handleProposeTrade}
          onAccept={acceptTrade}
          onReject={rejectTrade}
          onClose={() => setShowTradeForm(false)}
        />
      )}

      {room.status === 'FINISHED' && (
        <ResultModal gameState={gameState} onRestart={handleRestart} />
      )}
    </div>
  );
};

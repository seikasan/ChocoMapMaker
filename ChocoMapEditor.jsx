import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Download, Upload, Plus, Eraser, Layers, MousePointer2,
  Map, Ghost, Wrench, PackagePlus, X
} from 'lucide-react';

// --- 初期データと定数 ---
const CELL_SIZE = 40;

const DEFAULT_BLOCKS = [
  { id: 'eraser', name: '消しゴム', color: '#fca5a5', category: 'tool', icon: 'Eraser' },
  { id: 'ground', name: '床壁', color: '#8B4513', category: 'terrain' },
  { id: 'fountain', name: '噴水', color: '#D2691E', category: 'terrain' },
  { id: 'milk', name: 'ミルク', color: '#fef3c7', category: 'terrain' },
  { id: 'water', name: '水', color: '#38bdf8', category: 'terrain' },
  { id: 'door', name: 'ドア', color: '#808080', category: 'terrain' },
  { id: 'moving', name: '動く床', color: '#8080ff', category: 'terrain' },
  { id: 'coin', name: 'アラザン', color: '#d0d0d0', category: 'terrain' },
  { id: 'net', name: '網', color: '#d0d0d08a', category: 'terrain' },

  { id: 'marshmallow', name: 'マシュマロ', color: '#FFFFFF', category: 'enemy' },
  { id: 'gummy', name: 'グミ', color: '#f472b6', category: 'enemy' },
  { id: 'almond', name: 'アーモンド', color: '#DEB887', category: 'enemy' },
  { id: 'candy', name: 'わたパチ', color: '#b0ffff', category: 'enemy' },
  { id: 'mint', name: 'ミント', color: '#86efac', category: 'enemy' },
  { id: 'rrc', name: 'RRC', color: '#c026d3', category: 'enemy' },
  { id: 'gum', name: 'ガム', color: '#fbcfe8', category: 'enemy' },

  { id: 'knife', name: '包丁', color: '#fda4af', category: 'gimmick' },
  { id: 'paper', name: '包み紙', color: '#cbd5e1', category: 'gimmick' },
  { id: 'switch', name: 'スイッチ', color: '#f97316', category: 'gimmick' },
  { id: 'start', name: 'スタート', color: '#f974166c', category: 'gimmick' },
];

export default function ChocoMapEditor() {
  // --- ステート管理 ---
  const [mapData, setMapData] = useState({ fg: {}, bg: {} });
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const [activeLayer, setActiveLayer] = useState('fg'); // 'fg' | 'bg'
  const [selectedBlockId, setSelectedBlockId] = useState('ground');
  const [customBlocks, setCustomBlocks] = useState([]);
  const [hoverCell, setHoverCell] = useState(null);
  const [isSpaceDown, setIsSpaceDown] = useState(false);

  // モーダル用ステート
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newBlockName, setNewBlockName] = useState('');
  const [newBlockColor, setNewBlockColor] = useState('#8b5cf6');

  // 参照
  const containerRef = useRef(null);
  const isDrawingRef = useRef(false);
  const isPanningRef = useRef(false);
  const lastPosRef = useRef(null);
  const fileInputRef = useRef(null);

  const allBlocks = useMemo(() => [...DEFAULT_BLOCKS, ...customBlocks], [customBlocks]);
  const selectedBlock = useMemo(() => allBlocks.find(b => b.id === selectedBlockId), [allBlocks, selectedBlockId]);

  // --- イベントハンドラ ---
  useEffect(() => {
    const handleKeyDown = (e) => { if (e.code === 'Space') setIsSpaceDown(true); };
    const handleKeyUp = (e) => { if (e.code === 'Space') setIsSpaceDown(false); };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleWheel = useCallback((e) => {
    const zoomFactor = 1.1;
    const direction = e.deltaY > 0 ? -1 : 1;

    setCamera(prev => {
      let newZoom = prev.zoom * (direction > 0 ? zoomFactor : 1 / zoomFactor);
      newZoom = Math.max(0.1, Math.min(newZoom, 5));

      if (newZoom === prev.zoom) return prev;

      const rect = containerRef.current.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const worldX = (mx - prev.x) / prev.zoom;
      const worldY = (my - prev.y) / prev.zoom;

      const nx = mx - worldX * newZoom;
      const ny = my - worldY * newZoom;

      return { x: nx, y: ny, zoom: newZoom };
    });
  }, []);

  // ネイティブのwheelイベント（preventDefaultでブラウザスクロールを止めるため）
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleWheelNative = (e) => {
      e.preventDefault();
      handleWheel(e);
    };
    container.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => container.removeEventListener('wheel', handleWheelNative);
  }, [handleWheel]);

  const getCellCoords = (clientX, clientY) => {
    const rect = containerRef.current.getBoundingClientRect();
    const x = (clientX - rect.left - camera.x) / (CELL_SIZE * camera.zoom);
    const y = (clientY - rect.top - camera.y) / (CELL_SIZE * camera.zoom);
    return { x: Math.floor(x), y: Math.floor(y) };
  };

  const applyBlock = (x, y) => {
    const key = `${x},${y}`;
    setMapData(prev => {
      const layerData = { ...prev[activeLayer] };
      if (selectedBlockId === 'eraser') {
        delete layerData[key];
      } else {
        layerData[key] = selectedBlockId;
      }
      return { ...prev, [activeLayer]: layerData };
    });
  };

  const handlePointerDown = (e) => {
    if (e.button === 2 || e.button === 1 || isSpaceDown) {
      isPanningRef.current = true;
      lastPosRef.current = { x: e.clientX, y: e.clientY };
      document.body.style.cursor = 'grabbing';
      return;
    }
    if (e.button === 0) {
      isDrawingRef.current = true;
      const { x, y } = getCellCoords(e.clientX, e.clientY);
      applyBlock(x, y);
      lastPosRef.current = { x, y };
    }
  };

  const handlePointerMove = (e) => {
    if (isPanningRef.current) {
      const dx = e.clientX - lastPosRef.current.x;
      const dy = e.clientY - lastPosRef.current.y;
      setCamera(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
      lastPosRef.current = { x: e.clientX, y: e.clientY };
    } else {
      const { x, y } = getCellCoords(e.clientX, e.clientY);
      setHoverCell({ x, y });

      if (isDrawingRef.current) {
        if (!lastPosRef.current || lastPosRef.current.x !== x || lastPosRef.current.y !== y) {
          applyBlock(x, y);
          lastPosRef.current = { x, y };
        }
      }
    }
  };

  const handlePointerUp = () => {
    isDrawingRef.current = false;
    isPanningRef.current = false;
    document.body.style.cursor = 'default';
  };

  const handlePointerLeave = () => {
    handlePointerUp();
    setHoverCell(null);
  };

  // --- データ入出力 ---
  const exportData = () => {
    const data = { version: 1, customBlocks, mapData };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chocotabi_stage.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.mapData) {
          setMapData(data.mapData);
          setCustomBlocks(data.customBlocks || []);
        }
      } catch (err) {
        alert("ファイルの読み込みに失敗しました。");
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset
  };

  const handleAddCustomBlock = (e) => {
    e.preventDefault();
    if (!newBlockName.trim()) return;
    const newBlock = {
      id: 'custom_' + Date.now(),
      name: newBlockName,
      color: newBlockColor,
      category: 'custom'
    };
    setCustomBlocks([...customBlocks, newBlock]);
    setSelectedBlockId(newBlock.id);
    setIsModalOpen(false);
    setNewBlockName('');
  };

  // --- 描画関数 ---
  const renderLayerBlocks = (layerName, isTarget) => {
    const data = mapData[layerName];
    const elements = [];

    for (const [key, blockId] of Object.entries(data)) {
      const [x, y] = key.split(',').map(Number);
      const block = allBlocks.find(b => b.id === blockId);
      if (!block) continue;

      let zIndex = layerName === 'fg' ? 10 : 1;
      let opacity = 1;
      let scale = 1;
      let filter = 'none';

      // 非アクティブレイヤーの視覚調整（2.5Dの表現）
      if (activeLayer === 'fg' && layerName === 'bg') {
        opacity = 0.5;
        scale = 0.85;
        filter = 'brightness(0.6)';
        zIndex = 1;
      } else if (activeLayer === 'bg' && layerName === 'fg') {
        opacity = 0.25;
        scale = 1.1;
        zIndex = 20;
      }

      elements.push(
        <div
          key={key}
          className="absolute rounded shadow-sm border border-black/10 flex items-center justify-center overflow-hidden"
          style={{
            left: x * CELL_SIZE,
            top: y * CELL_SIZE,
            width: CELL_SIZE,
            height: CELL_SIZE,
            backgroundColor: block.color,
            opacity,
            transform: `scale(${scale})`,
            filter,
            zIndex,
            pointerEvents: 'none',
            transition: 'opacity 0.2s, transform 0.2s, filter 0.2s'
          }}
        >
          <span className="text-[10px] font-bold text-black/60 truncate px-1 pointer-events-none select-none">
            {block.name.substring(0, 2)}
          </span>
        </div>
      );
    }
    return elements;
  };

  // --- UIコンポーネント ---
  const renderPaletteGroup = (category, title, icon) => {
    const blocks = allBlocks.filter(b => b.category === category);
    if (blocks.length === 0) return null;
    return (
      <div className="mb-4">
        <h3 className="text-xs font-bold text-amber-900/60 mb-2 flex items-center gap-1 uppercase tracking-wider">
          {icon} {title}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {blocks.map(block => (
            <button
              key={block.id}
              onClick={() => setSelectedBlockId(block.id)}
              className={`flex items-center gap-2 p-1.5 rounded-md border-2 transition-all ${selectedBlockId === block.id
                ? 'border-amber-500 bg-amber-100 shadow-sm'
                : 'border-transparent hover:bg-amber-100/50'
                }`}
              title={block.name}
            >
              <div
                className="w-6 h-6 rounded flex-shrink-0 border border-black/10 flex items-center justify-center"
                style={{ backgroundColor: block.color }}
              >
                {block.id === 'eraser' && <Eraser size={14} className="text-red-700" />}
              </div>
              <span className="text-xs font-medium text-amber-900 truncate">
                {block.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen w-full overflow-hidden text-slate-800 font-sans bg-slate-900 select-none">

      {/* 左サイドバー：パレット */}
      <div className="w-64 bg-amber-50 border-r border-amber-200 flex flex-col shadow-xl z-20 h-full">
        <div className="p-4 border-b border-amber-200 bg-amber-100/50">
          <h1 className="text-xl font-extrabold text-amber-900 tracking-tight flex items-center gap-2">
            🍫 ちょこ旅 Editor
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {renderPaletteGroup('tool', 'ツール', <Wrench size={14} />)}
          {renderPaletteGroup('terrain', '地形・環境', <Map size={14} />)}
          {renderPaletteGroup('enemy', '敵キャラクター', <Ghost size={14} />)}
          {renderPaletteGroup('gimmick', 'ギミック', <PackagePlus size={14} />)}
          {renderPaletteGroup('custom', 'カスタム', <Layers size={14} />)}

          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full mt-2 py-2 border-2 border-dashed border-amber-300 text-amber-700 rounded-lg hover:bg-amber-100 hover:border-amber-400 transition-colors flex items-center justify-center gap-2 text-sm font-bold"
          >
            <Plus size={16} /> カスタムブロック追加
          </button>
        </div>

        <div className="p-4 bg-amber-100/50 border-t border-amber-200 text-xs text-amber-800/80">
          <p className="mb-1 flex items-center gap-1"><MousePointer2 size={12} /> 左クリック: 配置</p>
          <p className="mb-1 flex items-center gap-1"><MousePointer2 size={12} /> 右ドラッグ: 視点移動</p>
          <p className="flex items-center gap-1"><MousePointer2 size={12} /> ホイール: 拡大/縮小</p>
        </div>
      </div>

      {/* メインエリア */}
      <div className="flex-1 flex flex-col relative">
        {/* ヘッダー */}
        <div className="h-14 bg-amber-900 text-amber-50 flex items-center px-6 justify-between shadow-md z-10">
          <div className="flex items-center gap-4">
            <div className="text-sm font-medium bg-amber-800 px-3 py-1 rounded-full border border-amber-700 shadow-inner">
              現在のツール: <span className="font-bold text-amber-200">{selectedBlock?.name}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={exportData}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-700 hover:bg-amber-600 rounded-md text-sm font-medium transition-colors"
            >
              <Download size={16} /> 保存 (JSON)
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-700 hover:bg-amber-600 rounded-md text-sm font-medium transition-colors"
            >
              <Upload size={16} /> 読込
            </button>
            <input
              type="file"
              accept=".json"
              className="hidden"
              ref={fileInputRef}
              onChange={importData}
            />
          </div>
        </div>

        {/* キャンバスエリア */}
        <div
          ref={containerRef}
          className="flex-1 relative overflow-hidden bg-slate-200"
          style={{
            backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)`,
            backgroundSize: `${CELL_SIZE * camera.zoom}px ${CELL_SIZE * camera.zoom}px`,
            backgroundPosition: `${camera.x}px ${camera.y}px`,
            cursor: isSpaceDown ? 'grab' : 'crosshair'
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onContextMenu={e => e.preventDefault()}
        >
          <div
            style={{
              transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
              transformOrigin: '0 0',
              width: '100%',
              height: '100%',
              position: 'absolute',
              top: 0,
              left: 0,
              pointerEvents: 'none'
            }}
          >
            {/* 奥レイヤー */}
            {renderLayerBlocks('bg', activeLayer === 'bg')}

            {/* 手前レイヤー */}
            {renderLayerBlocks('fg', activeLayer === 'fg')}

            {/* ホバーカーソル（選択中ブロックのプレビュー） */}
            {hoverCell && selectedBlock && selectedBlockId !== 'eraser' && (
              <div
                className="absolute border-2 border-white shadow-[0_0_8px_rgba(0,0,0,0.5)] z-50 pointer-events-none rounded opacity-60"
                style={{
                  left: hoverCell.x * CELL_SIZE,
                  top: hoverCell.y * CELL_SIZE,
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                  backgroundColor: selectedBlock.color
                }}
              />
            )}
            {hoverCell && selectedBlockId === 'eraser' && (
              <div
                className="absolute border-2 border-red-500 bg-red-500/20 z-50 pointer-events-none rounded"
                style={{
                  left: hoverCell.x * CELL_SIZE,
                  top: hoverCell.y * CELL_SIZE,
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                }}
              />
            )}
          </div>
        </div>

        {/* レイヤー切り替えUI (中央下部) */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white p-1.5 rounded-full shadow-2xl flex border-2 border-amber-200 z-30">
          <button
            onClick={() => setActiveLayer('bg')}
            className={`px-6 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${activeLayer === 'bg'
              ? 'bg-amber-600 text-white shadow-md'
              : 'text-slate-500 hover:bg-amber-50'
              }`}
          >
            <Layers size={18} opacity={activeLayer === 'bg' ? 1 : 0.5} />
            奥レイヤー (背景)
          </button>
          <button
            onClick={() => setActiveLayer('fg')}
            className={`px-6 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${activeLayer === 'fg'
              ? 'bg-amber-500 text-white shadow-md'
              : 'text-slate-500 hover:bg-amber-50'
              }`}
          >
            <Layers size={18} className="transform translate-y-[-2px] translate-x-[2px]" />
            手前レイヤー (メイン)
          </button>
        </div>
      </div>

      {/* カスタムブロック追加モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-amber-50 rounded-xl shadow-2xl max-w-sm w-full border-2 border-amber-200 overflow-hidden">
            <div className="bg-amber-100 px-4 py-3 border-b border-amber-200 flex justify-between items-center">
              <h2 className="font-bold text-amber-900 flex items-center gap-2">
                <Plus size={18} /> 新しいブロックを作る
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-amber-700 hover:text-amber-900">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddCustomBlock} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-bold text-amber-900 mb-1">ブロックの名前</label>
                <input
                  type="text"
                  value={newBlockName}
                  onChange={(e) => setNewBlockName(e.target.value)}
                  className="w-full px-3 py-2 border border-amber-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  placeholder="例: トゲトゲチョコ"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-amber-900 mb-1">ブロックの色</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={newBlockColor}
                    onChange={(e) => setNewBlockColor(e.target.value)}
                    className="w-12 h-12 rounded cursor-pointer border-0 p-0"
                  />
                  <span className="text-sm font-mono text-slate-600 bg-white px-2 py-1 rounded border border-amber-200">
                    {newBlockColor}
                  </span>
                </div>
              </div>

              <div className="pt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2 rounded-md font-bold text-amber-800 bg-amber-200 hover:bg-amber-300 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-md font-bold text-white bg-amber-600 hover:bg-amber-700 transition-colors"
                >
                  追加する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(251, 191, 36, 0.1); 
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(217, 119, 6, 0.4); 
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(217, 119, 6, 0.6); 
        }
      `}} />
    </div>
  );
}
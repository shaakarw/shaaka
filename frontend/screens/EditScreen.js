// screens/AddPostScreen.js
import React, {
  useState, useEffect, useMemo, useRef, useCallback,
} from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image,
  ScrollView, Modal, Alert, ActivityIndicator, PanResponder,
  SafeAreaView, useWindowDimensions, Platform, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useBottomSheet } from '../context/BottomSheetContext';
import { getMaxMediaHeight } from '../utils/mediaLimits';

/* ================================================================== */
/*  MONOCHROME PALETTE (black / white / gray only)                    */
/* ================================================================== */
const DARK = {
  bg: '#000000',
  panel: '#1A1A1A',
  panel2: '#262626',
  text: '#FFFFFF',
  text2: '#BDBDBD',
  text3: '#8A8A8A',
  border: '#404040',
  accent: '#FFFFFF',
  onAccent: '#000000',
  overlay: 'rgba(0,0,0,0.55)',
  dim: 'rgba(0,0,0,0.60)',
  danger: '#FFFFFF',
  handle: '#FFFFFF',
};
const LIGHT = {
  bg: '#FFFFFF',
  panel: '#F5F5F5',
  panel2: '#EEEEEE',
  text: '#000000',
  text2: '#666666',
  text3: '#8A8A8A',
  border: '#D6D6D6',
  accent: '#000000',
  onAccent: '#FFFFFF',
  overlay: 'rgba(0,0,0,0.35)',
  dim: 'rgba(0,0,0,0.45)',
  danger: '#000000',
  handle: '#000000',
};

const useMono = () => {
  const { isDarkMode } = useTheme();
  return useMemo(() => (isDarkMode ? DARK : LIGHT), [isDarkMode]);
};

/* ================================================================== */
/*  CONSTANTS                                                         */
/* ================================================================== */
const MIN_CROP = 48;
const HANDLE = 22;
const MAX_TEXT_LEN = 120;

const ASPECTS = [
  { id: 'original', label: 'Original', ratio: null },
  { id: '1:1',      label: '1:1',      ratio: 1 },
  { id: '4:5',      label: '4:5',      ratio: 4 / 5 },
  { id: '9:16',     label: '9:16',     ratio: 9 / 16 },
  { id: '16:9',     label: '16:9',     ratio: 16 / 9 },
  { id: '3:4',      label: '3:4',      ratio: 3 / 4 },
];

const FILTERS = [
  { id: 'original',  label: 'Original',  tint: null },
  { id: 'natural',   label: 'Natural',   tint: '#FFE0B2', alpha: 0.06 },
  { id: 'warm',      label: 'Warm',      tint: '#FFB366', alpha: 0.16 },
  { id: 'cool',      label: 'Cool',      tint: '#6699FF', alpha: 0.16 },
  { id: 'vintage',   label: 'Vintage',   tint: '#B4825A', alpha: 0.22 },
  { id: 'cinematic', label: 'Cinematic', tint: '#0A3D62', alpha: 0.18 },
  { id: 'bw',        label: 'B&W',       tint: '#000000', alpha: 0 },
  { id: 'fade',      label: 'Fade',      tint: '#FFFFFF', alpha: 0.22 },
  { id: 'vivid',     label: 'Vivid',     tint: '#FF6B6B', alpha: 0.08 },
];

const ADJUSTMENTS = [
  { id: 'brightness', label: 'Brightness', icon: 'sunny-outline' },
  { id: 'contrast',   label: 'Contrast',   icon: 'contrast-outline' },
  { id: 'saturation', label: 'Saturation', icon: 'color-palette-outline' },
  { id: 'warmth',     label: 'Warmth',     icon: 'thermometer-outline' },
  { id: 'sharpness',  label: 'Sharpness',  icon: 'triangle-outline' },
  { id: 'fade',       label: 'Fade',       icon: 'water-outline' },
  { id: 'vignette',   label: 'Vignette',   icon: 'ellipse-outline' },
  { id: 'blur',       label: 'Blur',       icon: 'eye-off-outline' },
];

/* Only four text colors allowed. */
const TEXT_COLORS = ['#FFFFFF', '#000000', '#47AE87', '#D87428'];

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const isVideoUri = (uri) => /\.(mp4|mov|m4v|webm|mkv|avi)(\?.*)?$/i.test(uri || '');

/* ================================================================== */
/*  SLIDER — pan-driven, no extra dependency                          */
/* ================================================================== */
const Slider = ({ value, min, max, onChange, mono }) => {
  const [w, setW] = useState(0);
  const ref = useRef({ w: 0 });
  useEffect(() => { ref.current.w = w; }, [w]);

  const apply = (x) => {
    const width = ref.current.w || 1;
    onChange(min + clamp(x / width, 0, 1) * (max - min));
  };

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => apply(e.nativeEvent.locationX),
    onPanResponderMove: (e) => apply(e.nativeEvent.locationX),
  }), [min, max]);

  const pct = (value - min) / (max - min);
  return (
    <View style={{ height: 36, justifyContent: 'center', marginHorizontal: 12 }}
      onLayout={(e) => setW(e.nativeEvent.layout.width)} {...responder.panHandlers}>
      <View style={{ height: 3, backgroundColor: mono.panel2, borderRadius: 2 }}>
        <View style={{ height: 3, width: `${pct * 100}%`, backgroundColor: mono.accent, borderRadius: 2 }} />
      </View>
      <View style={{
        position: 'absolute', left: `${pct * 100}%`,
        width: 16, height: 16, borderRadius: 8, marginLeft: -8,
        backgroundColor: mono.accent,
      }} />
    </View>
  );
};

/* ================================================================== */
/*  DRAGGABLE TEXT OVERLAY                                            */
/*  - PanResponder is created ONCE (stable via refs)                  */
/*  - Drag works anywhere on the canvas (small off-screen allowance)  */
/* ================================================================== */
const DraggableText = ({ item, onMove, onTap, containerSize }) => {
  const start = useRef({ x: item.x, y: item.y });
  const moved = useRef(false);

  const itemRef = useRef(item);
  const containerRef = useRef(containerSize);
  const onMoveRef = useRef(onMove);
  const onTapRef = useRef(onTap);

  useEffect(() => { itemRef.current = item; }, [item]);
  useEffect(() => { containerRef.current = containerSize; }, [containerSize]);
  useEffect(() => { onMoveRef.current = onMove; }, [onMove]);
  useEffect(() => { onTapRef.current = onTap; }, [onTap]);

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      start.current = { x: itemRef.current.x, y: itemRef.current.y };
      moved.current = false;
    },
    onPanResponderMove: (_, g) => {
      if (Math.abs(g.dx) + Math.abs(g.dy) > 2) moved.current = true;
      const c = containerRef.current;
      // Allow a bit of off-screen so wide text is never trapped,
      // but keep at least ~20px visible on each axis.
      const nx = clamp(start.current.x + g.dx, -60, c.width - 20);
      const ny = clamp(start.current.y + g.dy, -15, c.height - 15);
      onMoveRef.current(itemRef.current.id, nx, ny);
    },
    onPanResponderRelease: () => {
      if (!moved.current) onTapRef.current(itemRef.current.id);
    },
  }), []);

  return (
    <View
      style={{
        position: 'absolute', left: item.x, top: item.y,
        paddingHorizontal: 6, paddingVertical: 3,
        borderWidth: item.selected ? 1 : 0,
        borderColor: 'rgba(255,255,255,0.85)',
        borderStyle: 'dashed',
      }}
      {...responder.panHandlers}
    >
      <Text style={{
        color: item.color,
        fontSize: item.fontSize,
        fontWeight: item.bold ? '800' : '600',
        textShadowColor: item.shadow ? 'rgba(0,0,0,0.75)' : 'transparent',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: item.shadow ? 4 : 0,
      }}>
        {item.content}
      </Text>
    </View>
  );
};

/* ================================================================== */
/*  TOOL CHIP                                                         */
/* ================================================================== */
const ToolChip = ({ icon, label, active, onPress, mono }) => (
  <TouchableOpacity onPress={onPress} style={[
    styles.chip,
    { backgroundColor: active ? mono.accent : mono.panel },
  ]}>
    <Ionicons name={icon} size={20} color={active ? mono.onAccent : mono.text2} />
    <Text style={[styles.chipLabel, { color: active ? mono.onAccent : mono.text2 }]} numberOfLines={1}>
      {label}
    </Text>
  </TouchableOpacity>
);

/* ================================================================== */
/*  MAIN SCREEN                                                       */
/* ================================================================== */
const AddPostScreen = () => {
  const mono = useMono();
  const navigation = useNavigation();
  const route = useRoute();
  const { showBottomSheet } = useBottomSheet();
  const { width: winW, height: winH } = useWindowDimensions();
  const maxMediaH = getMaxMediaHeight(winH);

  /* --- flow --- */
  // 'editor' → 'details'. Media always arrives via route.params.
  const [mode, setMode] = useState('editor');

  /* --- media --- */
  const [mediaUri, setMediaUri] = useState(route.params?.imageUri || route.params?.croppedImageUri || null);
  const [mediaType, setMediaType] = useState(route.params?.mediaType || 'image');
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });

  /* --- crop --- */
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [aspectId, setAspectId] = useState('original');
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);

  /* --- tools --- */
  const [activeTool, setActiveTool] = useState('crop');
  const [filter, setFilter] = useState('original');
  const [adj, setAdj] = useState({ brightness: 0, contrast: 0, saturation: 0, warmth: 0, sharpness: 0, fade: 0, vignette: 0, blur: 0 });

  /* --- overlays --- */
  const [texts, setTexts] = useState([]);
  const [selectedTextId, setSelectedTextId] = useState(null);

  /* --- text modal --- */
  const [textModal, setTextModal] = useState(false);
  const [editingTextId, setEditingTextId] = useState(null);
  const [draft, setDraft] = useState('');
  const [draftColor, setDraftColor] = useState('#FFFFFF');
  const [draftSize, setDraftSize] = useState(24);
  const [draftShadow, setDraftShadow] = useState(true);
  const [draftBold, setDraftBold] = useState(true);

  /* --- history --- */
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);

  /* --- misc --- */
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  /* --- post details --- */
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('');

  const dragStart = useRef(null);
  const isVideo = mediaType === 'video' || isVideoUri(mediaUri);

  /* ================================================================ */
  /*  Reset to editor whenever a new media URI is passed in           */
  /* ================================================================ */
  useEffect(() => {
    if (mediaUri) setMode('editor');
  }, [mediaUri]);

  /* ================================================================ */
  /*  LOAD IMAGE DIMENSIONS                                           */
  /* ================================================================ */
  useEffect(() => {
    if (!mediaUri || isVideo) return;
    Image.getSize(
      mediaUri,
      (w, h) => setImageSize({ width: w, height: h }),
      () => Alert.alert('Error', 'Failed to load image')
    );
  }, [mediaUri, isVideo]);

  /* ================================================================ */
  /*  COMPUTE DISPLAY SIZE (respects rotation)                        */
  /* ================================================================ */
  useEffect(() => {
    if (!imageSize.width) return;
    const rotated = rotation % 180 !== 0;
    const aspect = rotated ? imageSize.height / imageSize.width : imageSize.width / imageSize.height;
    const maxW = winW - 24;
    const maxH = Math.min(winH * 0.50, 520);
    let w, h;
    if (maxW / maxH > aspect) { h = maxH; w = h * aspect; }
    else { w = maxW; h = w / aspect; }
    setDisplaySize({ width: w, height: h });
    setCrop({ x: 0, y: 0, w, h });
  }, [imageSize, rotation, winW, winH]);

  /* ================================================================ */
  /*  HISTORY                                                         */
  /* ================================================================ */
  const snapshot = useCallback(() => ({
    crop, rotation, flipH, flipV, filter, adj, texts,
  }), [crop, rotation, flipH, flipV, filter, adj, texts]);

  const pushHistory = useCallback(() => {
    setHistory((h) => [...h.slice(-20), snapshot()]);
    setFuture([]);
  }, [snapshot]);

  const undo = () => {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setFuture((f) => [snapshot(), ...f].slice(0, 20));
    setHistory((h) => h.slice(0, -1));
    applySnapshot(prev);
  };
  const redo = () => {
    if (!future.length) return;
    const nxt = future[0];
    setHistory((h) => [...h, snapshot()]);
    setFuture((f) => f.slice(1));
    applySnapshot(nxt);
  };
  const applySnapshot = (s) => {
    setCrop(s.crop); setFilter(s.filter); setAdj(s.adj);
    setFlipH(s.flipH); setFlipV(s.flipV);
    setTexts(s.texts);
    if (s.rotation !== rotation) setRotation(s.rotation);
  };

  /* ================================================================ */
  /*  ASPECT PRESETS                                                  */
  /* ================================================================ */
  const applyAspect = (preset) => {
    pushHistory();
    setAspectId(preset.id);
    if (preset.ratio === null) {
      setCrop({ x: 0, y: 0, w: displaySize.width, h: displaySize.height });
      return;
    }
    const W = displaySize.width, H = displaySize.height;
    let w, h;
    if (W / H > preset.ratio) { h = H; w = h * preset.ratio; }
    else { w = W; h = w / preset.ratio; }
    setCrop({ x: (W - w) / 2, y: (H - h) / 2, w, h });
  };

  /* ================================================================ */
  /*  CROP GESTURES                                                   */
  /* ================================================================ */
  const makeHandle = (type) => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { dragStart.current = { ...crop }; },
    onPanResponderMove: (_, g) => {
      const s = dragStart.current;
      let { x, y, w, h } = s;
      if (type.includes('l')) { x = s.x + g.dx; w = s.w - g.dx; }
      if (type.includes('r')) { w = s.w + g.dx; }
      if (type.includes('t')) { y = s.y + g.dy; h = s.h - g.dy; }
      if (type.includes('b')) { h = s.h + g.dy; }
      if (w < MIN_CROP) { if (type.includes('l')) x = s.x + s.w - MIN_CROP; w = MIN_CROP; }
      if (h < MIN_CROP) { if (type.includes('t')) y = s.y + s.h - MIN_CROP; h = MIN_CROP; }
      x = clamp(x, 0, displaySize.width - MIN_CROP);
      y = clamp(y, 0, displaySize.height - MIN_CROP);
      w = Math.min(w, displaySize.width - x);
      h = Math.min(h, displaySize.height - y);
      setCrop({ x, y, w, h });
    },
  });

  const moveResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { dragStart.current = { ...crop }; },
    onPanResponderMove: (_, g) => {
      const s = dragStart.current;
      setCrop({
        x: clamp(s.x + g.dx, 0, displaySize.width - s.w),
        y: clamp(s.y + g.dy, 0, displaySize.height - s.h),
        w: s.w, h: s.h,
      });
    },
  }), [crop, displaySize]);

  /* ================================================================ */
  /*  TEXT TOOL                                                       */
  /* ================================================================ */
  const openAddText = () => {
    setEditingTextId(null);
    setDraft('');
    setDraftColor('#FFFFFF');
    setDraftSize(24);
    setDraftShadow(true);
    setDraftBold(true);
    setTextModal(true);
  };

  const openEditText = (id) => {
    const item = texts.find((t) => t.id === id);
    if (!item) return;
    setEditingTextId(id);
    setDraft(item.content);
    setDraftColor(item.color);
    setDraftSize(item.fontSize);
    setDraftShadow(item.shadow);
    setDraftBold(item.bold);
    setTextModal(true);
  };

  const commitText = () => {
    const content = draft.trim().slice(0, MAX_TEXT_LEN);
    if (!content) { setTextModal(false); return; }
    pushHistory();
    if (editingTextId) {
      setTexts((prev) => prev.map((t) => t.id === editingTextId
        ? { ...t, content, color: draftColor, fontSize: draftSize, shadow: draftShadow, bold: draftBold }
        : t));
    } else {
      const id = Date.now();
      const cx = displaySize.width / 2 - 40;
      const cy = displaySize.height / 2 - 16;
      setTexts((prev) => [
        ...prev,
        { id, content, x: cx, y: cy, color: draftColor, fontSize: draftSize, shadow: draftShadow, bold: draftBold, selected: false },
      ]);
      setSelectedTextId(id);
    }
    setTextModal(false);
  };

  const moveText = (id, x, y) => {
    setTexts((prev) => prev.map((t) => t.id === id ? { ...t, x, y } : t));
  };

  const selectText = (id) => {
    setTexts((prev) => prev.map((t) => ({ ...t, selected: t.id === id })));
    setSelectedTextId(id);
  };

  const deleteText = (id) => {
    pushHistory();
    setTexts((prev) => prev.filter((t) => t.id !== id));
    if (selectedTextId === id) setSelectedTextId(null);
  };

  /* ================================================================ */
  /*  FILTER TINT HELPER                                              */
  /* ================================================================ */
  const filterTint = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter);
    if (!f || !f.tint) return null;
    return { backgroundColor: f.tint, opacity: f.alpha ?? 0.1 };
  }, [filter]);

  /* ================================================================ */
  /*  SAVE — apply edits & go to details                              */
  /* ================================================================ */
  const handleNext = async () => {
    if (isSaving) return;
    if (isVideo) {
      navigation.navigate('AddPost', {
        editedMediaUri: mediaUri,
        editedMediaType: 'video',
        editedVideo: route.params?.video,
      });
      return;
    }
    setIsSaving(true);
    try {
      const actions = [];
      if (rotation !== 0) actions.push({ rotate: rotation });
      if (flipH) actions.push({ flip: ImageManipulator.FlipType.Horizontal });
      if (flipV) actions.push({ flip: ImageManipulator.FlipType.Vertical });
      const rotated = rotation % 180 !== 0;
      const postW = rotated ? imageSize.height : imageSize.width;
      const scale = postW / displaySize.width;
      const cropX = Math.max(0, Math.round(crop.x * scale));
      const cropY = Math.max(0, Math.round(crop.y * scale));
      const cropW = Math.max(1, Math.round(crop.w * scale));
      const cropH = Math.max(1, Math.round(crop.h * scale));
      actions.push({
        crop: {
          originX: cropX,
          originY: cropY,
          width: cropW,
          height: cropH,
        },
      });
      const result = await ImageManipulator.manipulateAsync(mediaUri, actions, {
        compress: 0.88,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      const dim = await new Promise((res, rej) =>
        Image.getSize(result.uri, (w, h) => res({ w, h }), rej));
      if (dim.h > maxMediaH) {
        throw new Error(`Output ${dim.h}px exceeds limit ${maxMediaH}px`);
      }
      navigation.navigate('AddPost', {
        editedMediaUri: result.uri,
        editedMediaType: 'image',
      });
    } catch (e) {
      showBottomSheet({ type: 'error', title: 'Export failed', message: String(e?.message || e), buttonText: 'OK' });
    } finally {
      setIsSaving(false);
    }
  };

  /* ================================================================ */
  /*  PUBLISH                                                         */
  /* ================================================================ */
  const handlePublish = async () => {
    if (!description.trim() && !mediaUri) {
      Alert.alert('Missing data', 'Please add a description.');
      return;
    }
    setIsProcessing(true);
    try {
      console.log('PUBLISH PAYLOAD', { mediaUri, description, price, location, category });
      navigation.goBack();
    } catch (e) {
      showBottomSheet({ type: 'error', title: 'Publish failed', message: String(e?.message || e), buttonText: 'OK' });
    } finally {
      setIsProcessing(false);
    }
  };

  /* ================================================================ */
  /*  CROP OVERLAY                                                    */
  /* ================================================================ */
  const renderCropOverlay = () => {
    if (activeTool !== 'crop') return null;
    const { x, y, w, h } = crop;
    return (
      <>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: y, backgroundColor: mono.dim }} />
        <View style={{ position: 'absolute', top: y + h, left: 0, right: 0, bottom: 0, backgroundColor: mono.dim }} />
        <View style={{ position: 'absolute', top: y, left: 0, width: x, height: h, backgroundColor: mono.dim }} />
        <View style={{ position: 'absolute', top: y, left: x + w, right: 0, height: h, backgroundColor: mono.dim }} />
        <View style={{ position: 'absolute', left: x, top: y, width: w, height: h, borderWidth: 2, borderColor: mono.handle }}>
          <View style={{ position: 'absolute', left: '33.33%', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.5)' }} />
          <View style={{ position: 'absolute', left: '66.66%', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.5)' }} />
          <View style={{ position: 'absolute', top: '33.33%', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.5)' }} />
          <View style={{ position: 'absolute', top: '66.66%', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.5)' }} />
          <View style={StyleSheet.absoluteFill} {...moveResponder.panHandlers} />
          {['tl','tr','bl','br'].map((pos) => (
            <View key={pos} style={[
              styles.handle,
              { backgroundColor: mono.handle, borderColor: mono.bg },
              pos === 'tl' && { top: -HANDLE/2, left: -HANDLE/2 },
              pos === 'tr' && { top: -HANDLE/2, right: -HANDLE/2 },
              pos === 'bl' && { bottom: -HANDLE/2, left: -HANDLE/2 },
              pos === 'br' && { bottom: -HANDLE/2, right: -HANDLE/2 },
            ]} {...makeHandle(pos).panHandlers} />
          ))}
          {['t','b','l','r'].map((pos) => (
            <View key={pos} style={[
              styles.handleRound,
              { backgroundColor: mono.handle, borderColor: mono.bg },
              pos === 't' && { top: -HANDLE/2, left: '50%', marginLeft: -HANDLE/2 },
              pos === 'b' && { bottom: -HANDLE/2, left: '50%', marginLeft: -HANDLE/2 },
              pos === 'l' && { top: '50%', left: -HANDLE/2, marginTop: -HANDLE/2 },
              pos === 'r' && { top: '50%', right: -HANDLE/2, marginTop: -HANDLE/2 },
            ]} {...makeHandle(pos).panHandlers} />
          ))}
        </View>
      </>
    );
  };

  /* ================================================================ */
  /*  TOOL PANELS (Stickers / Draw / Mosaic removed)                  */
  /* ================================================================ */
  const renderToolPanel = () => {
    const bg = { backgroundColor: mono.panel, borderColor: mono.border };

    if (activeTool === 'crop') {
      return (
        <View style={[styles.panel, bg]}>
          <Text style={[styles.panelTitle, { color: mono.text }]}>Aspect Ratio</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}>
            {ASPECTS.map((a) => {
              const on = a.id === aspectId;
              return (
                <TouchableOpacity key={a.id} onPress={() => applyAspect(a)} style={[
                  styles.aspectBtn, { borderColor: on ? mono.accent : mono.border },
                  on && { backgroundColor: mono.accent + '20' },
                ]}>
                  <View style={{
                    width: 20, height: 20, borderWidth: 2,
                    borderColor: on ? mono.accent : mono.text2,
                    aspectRatio: a.ratio || 1, borderRadius: 2,
                  }} />
                  <Text style={{ fontSize: 11, fontWeight: '600', color: on ? mono.accent : mono.text2 }}>{a.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={styles.rowWrap}>
            <TouchableOpacity style={styles.smallAction} onPress={() => { pushHistory(); setRotation((r) => (r + 270) % 360); }}>
              <Ionicons name="arrow-undo-outline" size={20} color={mono.text} />
              <Text style={[styles.smallActionLabel, { color: mono.text2 }]}>Rotate</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.smallAction} onPress={() => { pushHistory(); setRotation((r) => (r + 90) % 360); }}>
              <Ionicons name="arrow-redo-outline" size={20} color={mono.text} />
              <Text style={[styles.smallActionLabel, { color: mono.text2 }]}>Rotate</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.smallAction} onPress={() => { pushHistory(); setFlipH((v) => !v); }}>
              <Ionicons name="swap-horizontal-outline" size={20} color={mono.text} />
              <Text style={[styles.smallActionLabel, { color: mono.text2 }]}>Flip H</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.smallAction} onPress={() => { pushHistory(); setFlipV((v) => !v); }}>
              <Ionicons name="swap-vertical-outline" size={20} color={mono.text} />
              <Text style={[styles.smallActionLabel, { color: mono.text2 }]}>Flip V</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (activeTool === 'filter') {
      return (
        <View style={[styles.panel, bg]}>
          <Text style={[styles.panelTitle, { color: mono.text }]}>Filter</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}>
            {FILTERS.map((f) => {
              const on = f.id === filter;
              return (
                <TouchableOpacity key={f.id} onPress={() => { pushHistory(); setFilter(f.id); }} style={[
                  styles.filterChip, { borderColor: on ? mono.accent : mono.border },
                  on && { backgroundColor: mono.accent },
                ]}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: on ? mono.onAccent : mono.text2 }}>{f.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      );
    }

    if (ADJUSTMENTS.find((a) => a.id === activeTool)) {
      const v = adj[activeTool];
      return (
        <View style={[styles.panel, bg]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text style={[styles.panelTitle, { color: mono.text, marginBottom: 0 }]}>
              {ADJUSTMENTS.find((a) => a.id === activeTool).label}
            </Text>
            <Text style={{ color: mono.accent, fontWeight: '700' }}>{Math.round(v)}</Text>
          </View>
          <Slider value={v} min={-100} max={100} mono={mono} onChange={(x) => setAdj((s) => ({ ...s, [activeTool]: x }))} />
          <Text style={[styles.panelHint, { color: mono.text3 }]}>
            Live preview overlay. For pixel-level export use a dev build (Skia/FFmpeg).
          </Text>
        </View>
      );
    }

    if (activeTool === 'text') {
      return (
        <View style={[styles.panel, bg]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={[styles.panelTitle, { color: mono.text, marginBottom: 0 }]}>Text</Text>
            <TouchableOpacity onPress={openAddText} style={[styles.addBtn, { backgroundColor: mono.accent }]}>
              <Ionicons name="add" size={16} color={mono.onAccent} />
              <Text style={{ color: mono.onAccent, fontWeight: '700', fontSize: 12, marginLeft: 2 }}>Add Text</Text>
            </TouchableOpacity>
          </View>
          {texts.length === 0 ? (
            <Text style={[styles.panelHint, { color: mono.text3 }]}>
              Tap "Add Text", type, then drag it anywhere on the preview.
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {texts.map((tx) => (
                <View key={tx.id} style={[styles.textRow, { borderColor: mono.border }]}>
                  <Text numberOfLines={1} style={{ color: mono.text, fontSize: 12, maxWidth: 100 }}>{tx.content}</Text>
                  <TouchableOpacity onPress={() => openEditText(tx.id)} hitSlop={8}>
                    <Ionicons name="create-outline" size={16} color={mono.text2} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteText(tx.id)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={16} color={mono.text2} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
          <Text style={[styles.panelHint, { color: mono.text3 }]}>
            Drag text on the preview to place it anywhere.
          </Text>
        </View>
      );
    }

    return null;
  };

  /* ================================================================ */
  /*  FALLBACK: no media was passed                                   */
  /* ================================================================ */
  if (!mediaUri) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: mono.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Ionicons name="image-outline" size={48} color={mono.text3} />
        <Text style={{ color: mono.text2, marginTop: 12, textAlign: 'center' }}>
          No media selected. Please pick a photo or video from the previous screen.
        </Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            marginTop: 20, paddingHorizontal: 24, paddingVertical: 10,
            borderRadius: 999, backgroundColor: mono.accent,
          }}
        >
          <Text style={{ color: mono.onAccent, fontWeight: '700' }}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  /* ================================================================ */
  /*  EDITOR MODE                                                     */
  /* ================================================================ */
  if (mode === 'editor') {
    const rotated = rotation % 180 !== 0;
    const imgW = rotated ? displaySize.height : displaySize.width;
    const imgH = rotated ? displaySize.width  : displaySize.height;
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: mono.bg }}>
        {/* Header */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
            <Ionicons name="arrow-back" size={24} color={mono.text} />
          </TouchableOpacity>
          <Text style={{ color: mono.text, fontSize: 15, fontWeight: '700' }}>Crop & Edit</Text>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <TouchableOpacity onPress={undo} disabled={!history.length} style={{ opacity: history.length ? 1 : 0.3 }}>
              <Ionicons name="arrow-undo" size={20} color={mono.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={redo} disabled={!future.length} style={{ opacity: future.length ? 1 : 0.3 }}>
              <Ionicons name="arrow-redo" size={20} color={mono.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleNext} disabled={isSaving} style={[styles.nextBtn, { backgroundColor: mono.accent }]}>
              {isSaving ? <ActivityIndicator color={mono.onAccent} size="small" />
                : <Text style={{ color: mono.onAccent, fontWeight: '700', fontSize: 13 }}>Next</Text>}
            </TouchableOpacity>
          </View>
        </View>

        {/* Preview */}
        <View style={styles.previewWrap}>
          <View style={{ width: displaySize.width, height: displaySize.height, overflow: 'hidden', borderRadius: 10, backgroundColor: '#000' }}>
            {isVideo ? (
              <View style={styles.centerFill}>
                <Ionicons name="videocam" size={48} color="#fff" />
                <Text style={{ color: '#fff', marginTop: 8, fontSize: 12, textAlign: 'center', paddingHorizontal: 20 }}>
                  Video preview requires a dev build.{'\n'}Trim/speed/export: expo-video + FFmpeg.
                </Text>
              </View>
            ) : (
              <Image
                source={{ uri: mediaUri }}
                style={{
                  width: imgW, height: imgH,
                  transform: [
                    { rotate: `${rotation}deg` },
                    { scaleX: flipH ? -1 : 1 },
                    { scaleY: flipV ? -1 : 1 },
                  ],
                }}
                resizeMode="contain"
              />
            )}
            {filterTint && <View style={[StyleSheet.absoluteFill, filterTint]} />}
            {adj.brightness !== 0 && (
              <View style={[StyleSheet.absoluteFill, {
                backgroundColor: adj.brightness > 0 ? '#fff' : '#000',
                opacity: Math.abs(adj.brightness) / 250,
              }]} />
            )}
            {adj.vignette !== 0 && (
              <View style={[StyleSheet.absoluteFill, {
                borderWidth: Math.abs(adj.vignette) / 2,
                borderColor: adj.vignette > 0 ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.35)',
              }]} />
            )}
            {texts.map((tx) => (
              <DraggableText
                key={tx.id}
                item={tx}
                onMove={moveText}
                onTap={selectText}
                containerSize={displaySize}
              />
            ))}
          </View>
          <View style={[StyleSheet.absoluteFill, { pointerEvents: 'box-none' }]}>{renderCropOverlay()}</View>
        </View>

        {/* Tools */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <ToolChip icon="crop-outline"        label="Crop"       active={activeTool === 'crop'}       onPress={() => setActiveTool('crop')}       mono={mono} />
            <ToolChip icon="color-filter-outline" label="Filter"    active={activeTool === 'filter'}     onPress={() => setActiveTool('filter')}     mono={mono} />
            <ToolChip icon="sunny-outline"       label="Brightness" active={activeTool === 'brightness'} onPress={() => setActiveTool('brightness')} mono={mono} />
            <ToolChip icon="contrast-outline"    label="Contrast"   active={activeTool === 'contrast'}   onPress={() => setActiveTool('contrast')}   mono={mono} />
            <ToolChip icon="color-palette-outline" label="Saturation" active={activeTool === 'saturation'} onPress={() => setActiveTool('saturation')} mono={mono} />
            <ToolChip icon="thermometer-outline" label="Warmth"     active={activeTool === 'warmth'}     onPress={() => setActiveTool('warmth')}     mono={mono} />
            <ToolChip icon="triangle-outline"    label="Sharpness"  active={activeTool === 'sharpness'}  onPress={() => setActiveTool('sharpness')}  mono={mono} />
            <ToolChip icon="water-outline"       label="Fade"       active={activeTool === 'fade'}       onPress={() => setActiveTool('fade')}       mono={mono} />
            <ToolChip icon="ellipse-outline"     label="Vignette"   active={activeTool === 'vignette'}   onPress={() => setActiveTool('vignette')}   mono={mono} />
            <ToolChip icon="eye-off-outline"     label="Blur"       active={activeTool === 'blur'}       onPress={() => setActiveTool('blur')}       mono={mono} />
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <ToolChip icon="text-outline"        label="Text"       active={activeTool === 'text'}       onPress={() => setActiveTool('text')}       mono={mono} />
          </ScrollView>
          {renderToolPanel()}
        </ScrollView>

        {/* Text modal */}
        <Modal visible={textModal} transparent animationType="fade" onRequestClose={() => setTextModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBg}>
            <View style={[styles.modalCard, { backgroundColor: mono.panel }]}>
              <Text style={{ color: mono.text, fontSize: 16, fontWeight: '700', marginBottom: 10 }}>
                {editingTextId ? 'Edit Text' : 'Add Text'}
              </Text>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                autoFocus
                maxLength={MAX_TEXT_LEN}
                placeholder="Type your text…"
                placeholderTextColor={mono.text3}
                style={[styles.modalInput, { color: mono.text, borderColor: mono.border }]}
              />
              <View style={{ flexDirection: 'row', gap: 8, marginVertical: 10, flexWrap: 'wrap' }}>
                {TEXT_COLORS.map((c) => (
                  <TouchableOpacity key={c} onPress={() => setDraftColor(c)} style={{
                    width: 26, height: 26, borderRadius: 13, backgroundColor: c,
                    borderWidth: draftColor === c ? 2 : 1,
                    borderColor: draftColor === c ? mono.accent : mono.border,
                  }} />
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                {[16, 20, 24, 32, 40].map((s) => (
                  <TouchableOpacity key={s} onPress={() => setDraftSize(s)} style={[
                    styles.sizeBtn, { borderColor: draftSize === s ? mono.accent : mono.border },
                  ]}>
                    <Text style={{ color: draftSize === s ? mono.accent : mono.text2, fontSize: 12 }}>{s}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity onPress={() => setDraftBold((v) => !v)} style={[styles.sizeBtn, { borderColor: draftBold ? mono.accent : mono.border }]}>
                  <Text style={{ color: draftBold ? mono.accent : mono.text2, fontWeight: '800' }}>B</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setDraftShadow((v) => !v)} style={[styles.sizeBtn, { borderColor: draftShadow ? mono.accent : mono.border }]}>
                  <Ionicons name="layers-outline" size={16} color={draftShadow ? mono.accent : mono.text2} />
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                <TouchableOpacity onPress={() => setTextModal(false)} style={[styles.modalAction, { borderColor: mono.border }]}>
                  <Text style={{ color: mono.text }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={commitText} style={[styles.modalAction, { backgroundColor: mono.accent, borderColor: mono.accent }]}>
                  <Text style={{ color: mono.onAccent, fontWeight: '700' }}>{editingTextId ? 'Save' : 'Add'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    );
  }

  /* ================================================================ */
  /*  DETAILS MODE                                                    */
  /* ================================================================ */
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: mono.bg }}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => setMode('editor')} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={mono.text} />
        </TouchableOpacity>
        <Text style={{ color: mono.text, fontSize: 17, fontWeight: '700' }}>New Post</Text>
        <TouchableOpacity onPress={handlePublish} disabled={isProcessing}>
          <Text style={{ color: mono.accent, fontWeight: '700', fontSize: 15 }}>
            {isProcessing ? 'Posting…' : 'Share'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Image
            source={{ uri: mediaUri }}
            style={{ width: 80, height: 80, borderRadius: 8, backgroundColor: mono.panel }}
          />
          <View style={{ flex: 1, gap: 8 }}>
            <TextInput
              placeholder="Write a caption…"
              placeholderTextColor={mono.text3}
              multiline
              value={description}
              onChangeText={setDescription}
              style={[styles.input, { color: mono.text, borderColor: mono.border, backgroundColor: mono.panel }]}
            />
          </View>
        </View>

        <TextInput
          placeholder="Price (optional)"
          placeholderTextColor={mono.text3}
          keyboardType="numeric"
          value={price}
          onChangeText={setPrice}
          style={[styles.input, { color: mono.text, borderColor: mono.border, backgroundColor: mono.panel }]}
        />
        <TextInput
          placeholder="Location"
          placeholderTextColor={mono.text3}
          value={location}
          onChangeText={setLocation}
          style={[styles.input, { color: mono.text, borderColor: mono.border, backgroundColor: mono.panel }]}
        />
        <TextInput
          placeholder="Category"
          placeholderTextColor={mono.text3}
          value={category}
          onChangeText={setCategory}
          style={[styles.input, { color: mono.text, borderColor: mono.border, backgroundColor: mono.panel }]}
        />

        {isProcessing && (
          <View style={{ alignItems: 'center', paddingVertical: 20 }}>
            <ActivityIndicator color={mono.accent} />
            <Text style={{ color: mono.text2, marginTop: 8 }}>Uploading…</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

/* ================================================================== */
/*  STYLES                                                            */
/* ================================================================== */
const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  nextBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 999, minWidth: 60, alignItems: 'center',
  },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  previewWrap: {
    alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 12, marginBottom: 8,
  },
  handle: {
    position: 'absolute', width: HANDLE, height: HANDLE,
    borderRadius: 3, borderWidth: 1.5,
  },
  handleRound: {
    position: 'absolute', width: HANDLE - 4, height: HANDLE - 4,
    borderRadius: (HANDLE - 4) / 2, borderWidth: 1.5,
  },

  chipRow: { paddingHorizontal: 10, gap: 8, paddingVertical: 6 },
  chip: {
    width: 72, paddingVertical: 8, borderRadius: 12,
    alignItems: 'center', gap: 4,
  },
  chipLabel: { fontSize: 10, fontWeight: '600' },

  panel: {
    marginHorizontal: 12, marginVertical: 6,
    padding: 12, borderRadius: 14, borderWidth: 1,
  },
  panelTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  panelHint: { fontSize: 11, marginTop: 6, lineHeight: 15 },

  aspectBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, gap: 6,
  },
  rowWrap: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 },
  smallAction: { alignItems: 'center', flex: 1, paddingVertical: 6 },
  smallActionLabel: { fontSize: 10, marginTop: 2 },

  filterChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999, borderWidth: 1,
  },

  addBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
  },
  textRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1,
  },

  modalBg: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', padding: 20,
  },
  modalCard: { padding: 18, borderRadius: 16 },
  modalInput: {
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
  },
  sizeBtn: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1,
    minWidth: 40, alignItems: 'center',
  },
  modalAction: {
    flex: 1, height: 44, borderRadius: 22, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },

  input: {
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
    minHeight: 44,
  },
});

export default AddPostScreen;
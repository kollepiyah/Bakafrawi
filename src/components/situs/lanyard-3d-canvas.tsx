"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, extend, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Environment, Lightformer, RoundedBox } from "@react-three/drei";
import {
  BallCollider,
  CuboidCollider,
  Physics,
  RigidBody,
  useRopeJoint,
  useSphericalJoint,
  type RapierRigidBody,
} from "@react-three/rapier";
import { MeshLineGeometry, MeshLineMaterial } from "meshline";

extend({ MeshLineGeometry, MeshLineMaterial });

// Buat tekstur pita tali lanyard bertuliskan BAKAFRAWI · STUDIO
function buatTeksturTali(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 128;
  const ctx = c.getContext("2d")!;

  ctx.fillStyle = "#101319";
  ctx.fillRect(0, 0, c.width, c.height);

  // Garis tepi emas halus atas & bawah
  ctx.fillStyle = "rgba(201,162,75,0.45)";
  ctx.fillRect(0, 8, c.width, 4);
  ctx.fillRect(0, c.height - 12, c.width, 4);

  // Teks berulang
  ctx.fillStyle = "#e3c989";
  ctx.font = "700 34px system-ui, -apple-system, sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText("BAKAFRAWI  ·  STUDIO          BAKAFRAWI  ·  STUDIO", c.width / 2, c.height / 2 + 2);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

// Helper gambar rounded rect di canvas
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Gambar sisi depan kartu Studio Pass (mendukung foto portrait dari Admin atau emblem bawaan)
function gambarSisiDepan(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  nama: string,
  status: string,
  logoImg: HTMLImageElement | null,
  fotoImg: HTMLImageElement | null,
) {
  ctx.clearRect(0, 0, w, h);

  // Latar gradien gelap studio
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "#171c25");
  bg.addColorStop(0.55, "#0e1117");
  bg.addColorStop(1, "#080a0f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Pendar emas lembut di sudut kanan atas
  const glow = ctx.createRadialGradient(w * 0.85, h * 0.12, 20, w * 0.85, h * 0.12, w * 0.75);
  glow.addColorStop(0, "rgba(201,162,75,0.22)");
  glow.addColorStop(1, "rgba(201,162,75,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // Bingkai dalam tipis
  roundRectPath(ctx, 22, 22, w - 44, h - 44, 46);
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Slot lubang lanyard di atas
  roundRectPath(ctx, w / 2 - 78, 56, 156, 22, 11);
  ctx.fillStyle = "#040507";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Header: Logo + Nama + ID
  const headerY = 128;
  roundRectPath(ctx, 64, headerY, 108, 108, 28);
  ctx.fillStyle = "rgba(201,162,75,0.12)";
  ctx.fill();
  ctx.strokeStyle = "rgba(201,162,75,0.38)";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  if (logoImg) {
    ctx.drawImage(logoImg, 82, headerY + 18, 72, 72);
  }

  ctx.fillStyle = "#f2f3f5";
  ctx.font = "700 44px Georgia, serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`${nama}.`, 196, headerY + 12);

  ctx.fillStyle = "#9aa1ad";
  ctx.font = "600 22px system-ui, -apple-system, sans-serif";
  ctx.fillText("STUDIO PASS", 198, headerY + 68);

  // Badge ID · 01
  roundRectPath(ctx, w - 210, headerY + 26, 146, 52, 14);
  ctx.fillStyle = "rgba(201,162,75,0.13)";
  ctx.fill();
  ctx.strokeStyle = "rgba(201,162,75,0.38)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#e3c989";
  ctx.font = "600 24px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("ID · 01", w - 137, headerY + 52);

  // Area visual tengah (Foto Portrait dari Admin atau Emblem Kaligrafi)
  const boxX = 64;
  const boxY = 278;
  const boxW = w - 128;
  const boxH = 740;

  ctx.save();
  roundRectPath(ctx, boxX, boxY, boxW, boxH, 38);
  ctx.clip();

  if (fotoImg && fotoImg.naturalWidth > 0) {
    // Object-cover crop fokus bagian atas-tengah (aman untuk foto portrait)
    const imgRatio = fotoImg.naturalWidth / fotoImg.naturalHeight;
    const boxRatio = boxW / boxH;
    let drawW = boxW;
    let drawH = boxH;
    let drawX = boxX;
    let drawY = boxY;
    if (imgRatio > boxRatio) {
      drawW = boxH * imgRatio;
      drawX = boxX - (drawW - boxW) / 2;
    } else {
      drawH = boxW / imgRatio;
      drawY = boxY - (drawH - boxH) * 0.18;
    }
    ctx.drawImage(fotoImg, drawX, drawY, drawW, drawH);

    // Gradasi gelap bawah agar teks & status terbaca tajam
    const grad = ctx.createLinearGradient(0, boxY + boxH * 0.45, 0, boxY + boxH);
    grad.addColorStop(0, "rgba(8,10,15,0)");
    grad.addColorStop(0.65, "rgba(8,10,15,0.78)");
    grad.addColorStop(1, "rgba(8,10,15,0.96)");
    ctx.fillStyle = grad;
    ctx.fillRect(boxX, boxY, boxW, boxH);

    ctx.fillStyle = "#f4f5f7";
    ctx.font = "700 42px Georgia, serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText("Software & Design Studio", boxX + 38, boxY + boxH - 96);

    // Lencana status hijau
    const teksStatus = status.slice(0, 32);
    ctx.font = "600 24px system-ui, -apple-system, sans-serif";
    const statusW = Math.min(boxW - 76, ctx.measureText(teksStatus).width + 82);
    roundRectPath(ctx, boxX + 38, boxY + boxH - 76, statusW, 48, 24);
    ctx.fillStyle = "rgba(16,185,129,0.18)";
    ctx.fill();
    ctx.strokeStyle = "rgba(52,211,153,0.45)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(boxX + 68, boxY + boxH - 52, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#34d399";
    ctx.fill();

    ctx.fillStyle = "#6ee7b7";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(teksStatus, boxX + 90, boxY + boxH - 51);
  } else {
    // Fallback emblem elegan jika foto belum diunggah di Admin
    const panelBg = ctx.createLinearGradient(boxX, boxY, boxX + boxW, boxY + boxH);
    panelBg.addColorStop(0, "rgba(255,255,255,0.04)");
    panelBg.addColorStop(1, "rgba(0,0,0,0.5)");
    ctx.fillStyle = panelBg;
    ctx.fillRect(boxX, boxY, boxW, boxH);

    // Cahaya radial di tengah
    const centerGlow = ctx.createRadialGradient(
      w / 2,
      boxY + 260,
      20,
      w / 2,
      boxY + 260,
      280,
    );
    centerGlow.addColorStop(0, "rgba(201,162,75,0.32)");
    centerGlow.addColorStop(1, "rgba(201,162,75,0)");
    ctx.fillStyle = centerGlow;
    ctx.fillRect(boxX, boxY, boxW, boxH);

    // Kotak medali logo
    roundRectPath(ctx, w / 2 - 125, boxY + 135, 250, 250, 56);
    ctx.fillStyle = "rgba(201,162,75,0.12)";
    ctx.fill();
    ctx.strokeStyle = "rgba(201,162,75,0.45)";
    ctx.lineWidth = 3;
    ctx.stroke();

    if (logoImg) {
      ctx.drawImage(logoImg, w / 2 - 82, boxY + 178, 164, 164);
    }

    ctx.fillStyle = "#f4f5f7";
    ctx.font = "700 46px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Software & Design Studio", w / 2, boxY + 470);

    ctx.fillStyle = "#9aa1ad";
    ctx.font = "500 28px system-ui, -apple-system, sans-serif";
    ctx.fillText("Sidoarjo · Jawa Timur", w / 2, boxY + 530);

    // Badge status hijau
    const teksStatus = status.slice(0, 32);
    ctx.font = "600 26px system-ui, -apple-system, sans-serif";
    const statusW = Math.min(boxW - 96, ctx.measureText(teksStatus).width + 92);
    roundRectPath(ctx, w / 2 - statusW / 2, boxY + 592, statusW, 56, 28);
    ctx.fillStyle = "rgba(16,185,129,0.16)";
    ctx.fill();
    ctx.strokeStyle = "rgba(52,211,153,0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(w / 2 - statusW / 2 + 34, boxY + 620, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#34d399";
    ctx.fill();

    ctx.fillStyle = "#6ee7b7";
    ctx.textAlign = "left";
    ctx.fillText(teksStatus, w / 2 - statusW / 2 + 56, boxY + 621);
  }
  ctx.restore();

  // Garis bingkai kotak visual tengah
  roundRectPath(ctx, boxX, boxY, boxW, boxH, 38);
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Pill keahlian mini
  const tags = ["Web App", "Android", "POS", "AI Studio"];
  const pillW = 198;
  const gap = 22;
  const totalW = tags.length * pillW + (tags.length - 1) * gap;
  let px = (w - totalW) / 2;
  const py = 1072;
  tags.forEach((t) => {
    roundRectPath(ctx, px, py, pillW, 56, 28);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#d4d4d8";
    ctx.font = "600 24px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(t, px + pillW / 2, py + 29);
    px += pillW + gap;
  });

  // Footer garis & domain
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(64, 1188);
  ctx.lineTo(w - 64, 1188);
  ctx.stroke();

  ctx.fillStyle = "#71717a";
  ctx.font = "500 26px ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("bakafrawi.com", 64, 1250);

  ctx.fillStyle = "#e3c989";
  ctx.textAlign = "right";
  ctx.fillText("✦ 3D INTERACTIVE", w - 64, 1250);
}

// Gambar sisi belakang kartu (terlihat saat kartu berputar 360°)
function gambarSisiBelakang(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  nama: string,
  logoImg: HTMLImageElement | null,
) {
  ctx.clearRect(0, 0, w, h);

  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "#12161e");
  bg.addColorStop(1, "#080a0f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  roundRectPath(ctx, 22, 22, w - 44, h - 44, 46);
  ctx.strokeStyle = "rgba(201,162,75,0.28)";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Pendar tengah
  const glow = ctx.createRadialGradient(w / 2, h / 2 - 40, 20, w / 2, h / 2 - 40, 360);
  glow.addColorStop(0, "rgba(201,162,75,0.24)");
  glow.addColorStop(1, "rgba(201,162,75,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // Cincin dekoratif
  ctx.beginPath();
  ctx.arc(w / 2, h / 2 - 40, 210, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(201,162,75,0.3)";
  ctx.setLineDash([12, 12]);
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.setLineDash([]);

  if (logoImg) {
    ctx.drawImage(logoImg, w / 2 - 110, h / 2 - 150, 220, 220);
  }

  ctx.fillStyle = "#e3c989";
  ctx.font = "700 44px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${nama.toUpperCase()} PROJECT`, w / 2, h / 2 + 240);

  ctx.fillStyle = "#8a929e";
  ctx.font = "500 28px ui-monospace, monospace";
  ctx.fillText("bakafrawi.com · Sidoarjo", w / 2, h / 2 + 305);
}

function Band({
  nama,
  status,
  fotoUrl,
  maxSpeed = 50,
  minSpeed = 0,
}: {
  nama: string;
  status: string;
  fotoUrl?: string;
  maxSpeed?: number;
  minSpeed?: number;
}) {
  const bandRef = useRef<THREE.Mesh>(null);
  const fixed = useRef<RapierRigidBody>(null);
  const j1 = useRef<RapierRigidBody>(null);
  const j2 = useRef<RapierRigidBody>(null);
  const j3 = useRef<RapierRigidBody>(null);
  const card = useRef<RapierRigidBody>(null);

  const vec = useMemo(() => new THREE.Vector3(), []);
  const ang = useMemo(() => new THREE.Vector3(), []);
  const rot = useMemo(() => new THREE.Vector3(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);

  const { size } = useThree();
  const [dragged, setDragged] = useState<THREE.Vector3 | false>(false);
  const [hovered, setHovered] = useState(false);

  // Kurva tali lanyard
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
      ]),
    [],
  );

  const teksturTali = useMemo(() => buatTeksturTali(), []);

  // Kanvas dinamis sisi depan & belakang kartu
  const { teksturDepan, teksturBelakang, canvasDepan, canvasBelakang } = useMemo(() => {
    const cd = document.createElement("canvas");
    cd.width = 1024;
    cd.height = 1360;
    const cb = document.createElement("canvas");
    cb.width = 1024;
    cb.height = 1360;
    const td = new THREE.CanvasTexture(cd);
    td.colorSpace = THREE.SRGBColorSpace;
    td.anisotropy = 8;
    const tb = new THREE.CanvasTexture(cb);
    tb.colorSpace = THREE.SRGBColorSpace;
    tb.anisotropy = 8;
    return { teksturDepan: td, teksturBelakang: tb, canvasDepan: cd, canvasBelakang: cb };
  }, []);

  // Render tekstur kartu saat nama, status, atau fotoUrl dari Admin berubah
  useEffect(() => {
    let aktif = true;
    const ctxD = canvasDepan.getContext("2d")!;
    const ctxB = canvasBelakang.getContext("2d")!;

    let logoImg: HTMLImageElement | null = null;
    let fotoImg: HTMLImageElement | null = null;

    const lukis = () => {
      if (!aktif) return;
      gambarSisiDepan(ctxD, canvasDepan.width, canvasDepan.height, nama, status, logoImg, fotoImg);
      gambarSisiBelakang(ctxB, canvasBelakang.width, canvasBelakang.height, nama, logoImg);
      teksturDepan.needsUpdate = true;
      teksturBelakang.needsUpdate = true;
    };

    // Gambar awal langsung (teks + bingkai)
    lukis();

    // Muat logo kaligrafi Bakafrawi
    const imgLogo = new window.Image();
    imgLogo.crossOrigin = "anonymous";
    imgLogo.onload = () => {
      logoImg = imgLogo;
      lukis();
    };
    imgLogo.src = "/logo.png";

    // Muat foto dari Admin jika ada (pakai fetch→blob agar bebas masalah cache CORS di WebGL)
    let blobUrl: string | null = null;
    if (fotoUrl) {
      const muatViaImg = (src: string) => {
        const imgFoto = new window.Image();
        imgFoto.crossOrigin = "anonymous";
        imgFoto.onload = () => {
          fotoImg = imgFoto;
          lukis();
        };
        imgFoto.src = src;
      };

      fetch(fotoUrl, { mode: "cors" })
        .then((res) => (res.ok ? res.blob() : Promise.reject(new Error("fetch gagal"))))
        .then((blob) => {
          if (!aktif) return;
          blobUrl = URL.createObjectURL(blob);
          muatViaImg(blobUrl);
        })
        .catch(() => {
          if (!aktif) return;
          muatViaImg(fotoUrl);
        });
    }

    return () => {
      aktif = false;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [nama, status, fotoUrl, canvasDepan, canvasBelakang, teksturDepan, teksturBelakang]);

  // Bersihkan resource GPU saat unmount
  useEffect(() => {
    return () => {
      teksturTali.dispose();
      teksturDepan.dispose();
      teksturBelakang.dispose();
    };
  }, [teksturTali, teksturDepan, teksturBelakang]);

  // Ubah kursor saat hover / drag
  useEffect(() => {
    if (hovered) {
      document.body.style.cursor = dragged ? "grabbing" : "grab";
      return () => {
        document.body.style.cursor = "auto";
      };
    }
  }, [hovered, dragged]);

  // Sambungan tali fisika Rapier
  useRopeJoint(fixed as never, j1 as never, [[0, 0, 0], [0, 0, 0], 0.95]);
  useRopeJoint(j1 as never, j2 as never, [[0, 0, 0], [0, 0, 0], 0.95]);
  useRopeJoint(j2 as never, j3 as never, [[0, 0, 0], [0, 0, 0], 0.95]);
  useSphericalJoint(j3 as never, card as never, [[0, 0, 0], [0, 1.32, 0]]);

  // Dorongan halus pertama kali saat kartu muncul agar langsung mengayun hidup
  const sudahDorong = useRef(false);
  const lerped1 = useRef(new THREE.Vector3());
  const lerped2 = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    if (!sudahDorong.current && card.current) {
      sudahDorong.current = true;
      card.current.applyImpulse({ x: 0.9, y: 0, z: 0.35 }, true);
    }

    if (dragged && card.current) {
      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
      dir.copy(vec).sub(state.camera.position).normalize();
      vec.add(dir.multiplyScalar(state.camera.position.length()));
      [card, j1, j2, j3, fixed].forEach((r) => r.current?.wakeUp());
      card.current.setNextKinematicTranslation({
        x: vec.x - dragged.x,
        y: vec.y - dragged.y,
        z: vec.z - dragged.z,
      });
    }

    if (fixed.current && j1.current && j2.current && j3.current && card.current) {
      const t1 = j1.current.translation();
      const t2 = j2.current.translation();
      const t3 = j3.current.translation();
      const tf = fixed.current.translation();

      if (lerped1.current.lengthSq() === 0) {
        lerped1.current.set(t1.x, t1.y, t1.z);
        lerped2.current.set(t2.x, t2.y, t2.z);
      } else {
        const d1 = Math.max(0.1, Math.min(1, lerped1.current.distanceTo(vec.set(t1.x, t1.y, t1.z))));
        lerped1.current.lerp(vec.set(t1.x, t1.y, t1.z), delta * (minSpeed + d1 * (maxSpeed - minSpeed)));
        const d2 = Math.max(0.1, Math.min(1, lerped2.current.distanceTo(vec.set(t2.x, t2.y, t2.z))));
        lerped2.current.lerp(vec.set(t2.x, t2.y, t2.z), delta * (minSpeed + d2 * (maxSpeed - minSpeed)));
      }

      curve.points[0].set(t3.x, t3.y, t3.z);
      curve.points[1].copy(lerped2.current);
      curve.points[2].copy(lerped1.current);
      curve.points[3].set(tf.x, tf.y, tf.z);

      const geom = bandRef.current?.geometry as MeshLineGeometry | undefined;
      if (geom && typeof geom.setPoints === "function") {
        geom.setPoints(curve.getPoints(32));
      }

      // Redam sedikit putaran Y agar kartu tidak berputar liar tak berhenti
      ang.copy(card.current.angvel());
      rot.copy(card.current.rotation());
      card.current.setAngvel({ x: ang.x, y: ang.y - rot.y * 0.25, z: ang.z }, true);
    }
  });

  const segmentProps = {
    type: "dynamic" as const,
    canSleep: true,
    colliders: false as const,
    angularDamping: 4,
    linearDamping: 4,
  };

  function mulaiTarik(e: ThreeEvent<PointerEvent>) {
    e.stopPropagation();
    (e.target as HTMLElement | null)?.setPointerCapture?.(e.pointerId);
    if (!card.current) return;
    const t = card.current.translation();
    setDragged(new THREE.Vector3().copy(e.point).sub(new THREE.Vector3(t.x, t.y, t.z)));
  }

  function lepasTarik(e: ThreeEvent<PointerEvent>) {
    e.stopPropagation();
    (e.target as HTMLElement | null)?.releasePointerCapture?.(e.pointerId);
    setDragged(false);
  }

  const lineGeom = useMemo(() => new MeshLineGeometry(), []);
  const lineMat = useMemo(
    () =>
      new MeshLineMaterial({
        color: "#ffffff",
        depthTest: false,
        resolution: new THREE.Vector2(size.width || 400, size.height || 520),
        useMap: 1,
        map: teksturTali,
        repeat: new THREE.Vector2(-3, 1),
        lineWidth: 0.42,
      } as never),
    [teksturTali, size.width, size.height],
  );

  useEffect(() => {
    return () => {
      lineGeom.dispose();
      lineMat.dispose();
    };
  }, [lineGeom, lineMat]);

  return (
    <>
      <group position={[0, 4.15, 0]}>
        <RigidBody ref={fixed} {...segmentProps} type="fixed" />
        <RigidBody position={[0.45, -0.5, 0]} ref={j1} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[0.9, -1.0, 0]} ref={j2} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1.35, -1.5, 0]} ref={j3} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>

        <RigidBody
          position={[1.55, -2.5, 0]}
          ref={card}
          {...segmentProps}
          type={dragged ? "kinematicPosition" : "dynamic"}
        >
          <CuboidCollider args={[0.82, 1.12, 0.04]} />
          <group
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
            onPointerUp={lepasTarik}
            onPointerDown={mulaiTarik}
          >
            {/* Badan utama kartu 3D (RoundedBox metalik gelap) */}
            <RoundedBox args={[1.72, 2.28, 0.055]} radius={0.1} smoothness={4}>
              <meshPhysicalMaterial
                color="#141820"
                clearcoat={1}
                clearcoatRoughness={0.18}
                roughness={0.3}
                metalness={0.75}
              />
            </RoundedBox>

            {/* Permukaan Depan (Foto Admin / Emblem + Nama + Status) */}
            <mesh position={[0, 0, 0.03]}>
              <planeGeometry args={[1.64, 2.2]} />
              <meshPhysicalMaterial
                map={teksturDepan}
                clearcoat={1}
                clearcoatRoughness={0.12}
                roughness={0.22}
                metalness={0.12}
              />
            </mesh>

            {/* Permukaan Belakang (Logo Kaligrafi & Domain saat diputar 360°) */}
            <mesh position={[0, 0, -0.03]} rotation={[0, Math.PI, 0]}>
              <planeGeometry args={[1.64, 2.2]} />
              <meshPhysicalMaterial
                map={teksturBelakang}
                clearcoat={1}
                clearcoatRoughness={0.15}
                roughness={0.25}
                metalness={0.18}
              />
            </mesh>

            {/* Klip & pengait logam 3D di atas kartu */}
            <mesh position={[0, 1.2, 0]}>
              <boxGeometry args={[0.28, 0.16, 0.1]} />
              <meshStandardMaterial color="#b5bac4" metalness={0.92} roughness={0.22} />
            </mesh>
            <mesh position={[0, 1.32, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.045, 0.045, 0.36, 16]} />
              <meshStandardMaterial color="#d4af5f" metalness={0.9} roughness={0.25} />
            </mesh>
          </group>
        </RigidBody>
      </group>

      {/* Tali Lanyard 3D (MeshLine mengikuti kurva fisika Rapier) */}
      <mesh ref={bandRef} geometry={lineGeom} material={lineMat} />
    </>
  );
}

export default function Lanyard3DCanvas({
  nama,
  status,
  fotoUrl,
}: {
  nama: string;
  status: string;
  fotoUrl?: string;
}) {
  return (
    <Canvas
      camera={{ position: [0, 0, 11.5], fov: 22 }}
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      onCreated={({ gl }) => gl.setClearColor(new THREE.Color(0x000000), 0)}
      className="size-full touch-none"
    >
      <ambientLight intensity={Math.PI * 0.7} />
      <Physics interpolate gravity={[0, -38, 0]} timeStep={1 / 60}>
        <Band nama={nama} status={status} fotoUrl={fotoUrl} />
      </Physics>
      <Environment blur={0.75}>
        <Lightformer
          intensity={2.4}
          color="#fff4d6"
          position={[0, -1, 5]}
          rotation={[0, 0, Math.PI / 3]}
          scale={[100, 0.15, 1]}
        />
        <Lightformer
          intensity={3.2}
          color="#ffffff"
          position={[-2, -1, 2]}
          rotation={[0, 0, Math.PI / 3]}
          scale={[100, 0.15, 1]}
        />
        <Lightformer
          intensity={2.8}
          color="#18b4a8"
          position={[2, 1, 2]}
          rotation={[0, 0, Math.PI / 3]}
          scale={[100, 0.15, 1]}
        />
        <Lightformer
          intensity={8}
          color="#f7e6bd"
          position={[-10, 0, 14]}
          rotation={[0, Math.PI / 2, Math.PI / 3]}
          scale={[100, 10, 1]}
        />
      </Environment>
    </Canvas>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Candy, Milk, Soup, Pencil, Send, ScrollText, CheckCircle2, Copy, Check, Download } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

type Tier = {
  id: string;
  label: string;
  amount: number | 'custom';
  icon: React.ReactNode;
  color: string;
};

const TIERS: Tier[] = [
  { id: 'candy', label: 'Rp 5.000', amount: 5000, icon: <Candy className="w-8 h-8" />, color: 'bg-sketch-pink' },
  { id: 'juice', label: 'Rp 10.000', amount: 10000, icon: <Milk className="w-8 h-8" />, color: 'bg-sketch-blue' },
  { id: 'ramen', label: 'Rp 25.000', amount: 25000, icon: <Soup className="w-8 h-8" />, color: 'bg-sketch-yellow' },
  { id: 'custom', label: 'Lainnya', amount: 'custom', icon: <Pencil className="w-8 h-8" />, color: 'bg-white' },
];

/**
 * Robust QRIS Generator Logic
 */
function qrisCrc16(data: string): string {
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
        crc ^= data.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            if ((crc & 0x8000) !== 0) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc <<= 1;
            }
        }
    }
    crc &= 0xFFFF;
    return crc.toString(16).toUpperCase().padStart(4, '0');
}

export default function App() {
  const [selectedTier, setSelectedTier] = useState<string>('candy');
  const [customAmount, setCustomAmount] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [email, setEmail] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Validation state
  const [errors, setErrors] = useState<{ [key: string]: boolean }>({});
  const qrRef = useRef<SVGSVGElement>(null);

  // Scroll to top when view changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [showPayment, showSuccess]);

  const downloadQR = () => {
    if (!qrRef.current) return;
    
    const svg = qrRef.current;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width + 40; // Add padding
      canvas.height = img.height + 140; // Add padding for footer
      if (ctx) {
        // Draw background
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw header text
        ctx.fillStyle = "black";
        ctx.font = "bold 20px Inter"; // Slightly smaller font to fit longer text
        ctx.textAlign = "center";
        ctx.fillText("HENDRA STORE, HIBURAN", canvas.width / 2, 40);
        
        // Draw QR
        ctx.drawImage(img, 20, 60);
        
        // Draw Amount text
        ctx.font = "bold 32px Inter";
        ctx.fillText(`Rp ${donationAmount.toLocaleString('id-ID')}`, canvas.width / 2, img.height + 100);
        
        // Draw Footer
        ctx.font = "14px Inter";
        ctx.fillStyle = "#666";
        ctx.fillText("HenKarmazov.my.id", canvas.width / 2, img.height + 130);
        
        const pngFile = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.download = `QRIS-Donasi-${donationAmount}.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
      }
    };
    
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const donationAmount = useMemo(() => {
    if (selectedTier === 'custom') {
      const raw = customAmount.replace(/\./g, '');
      return parseInt(raw) || 0;
    }
    const tier = TIERS.find(t => t.id === selectedTier);
    return typeof tier?.amount === 'number' ? tier.amount : 0;
  }, [selectedTier, customAmount]);

  const dynamicQRIS = useMemo(() => {
    const basePayload = "00020101021126610014COM.GO-JEK.WWW01189360091434096849760210G4096849760303UMI51440014ID.CO.QRIS.WWW0215ID10264759438780303UMI5204792953033605802ID5921HENDRA STORE, Hiburan6008SUKABUMI61054335962070703A01630437DD"; 
    
    if (!donationAmount) return basePayload;

    try {
        const tags: Record<string, string> = {};
        let i = 0;
        // Parse the base payload into tags
        while (i < basePayload.length) {
            const tag = basePayload.substring(i, i + 2);
            const len = parseInt(basePayload.substring(i + 2, i + 4));
            if (isNaN(len)) break;
            const value = basePayload.substring(i + 4, i + 4 + len);
            tags[tag] = value;
            i += 4 + len;
        }

        // Apply dynamic changes
        tags['01'] = '12'; // Set Point of Initiation Method to Dynamic
        tags['54'] = donationAmount.toString(); // Transaction Amount

        // Reassemble the payload (without CRC)
        let newPayload = "";
        // EMVCo tags should be in order usually, but sorted is safe for recalculation
        const sortedTags = Object.keys(tags).filter(t => t !== '63').sort();
        for (const tag of sortedTags) {
            const val = tags[tag];
            const len = val.length.toString().padStart(2, '0');
            newPayload += tag + len + val;
        }

        // Add CRC Header
        newPayload += "6304";
        
        // Calculate new CRC
        const crc = qrisCrc16(newPayload);
        return newPayload + crc;
    } catch (err) {
        console.error("QRIS Generation Error:", err);
        return basePayload; // Fallback to original
    }
  }, [donationAmount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: boolean } = {};
    if (!name) newErrors.name = true;
    if (!email || !email.includes('@')) newErrors.email = true;
    if (selectedTier === 'custom' && !customAmount) newErrors.amount = true;
    if (!isConfirmed) newErrors.confirmation = true;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      // Remove jitter after a short duration
      setTimeout(() => setErrors({}), 2000);
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/donations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          amount: donationAmount,
          message,
          isPrivate,
        }),
      });

      if (response.ok) {
        setIsSubmitting(false);
        setShowPayment(true);
      } else {
        throw new Error('Failed to save donation');
      }
    } catch (error) {
      console.error('Error:', error);
      setIsSubmitting(false);
      // If DB fails, we still show payment for demo purposes, 
      // but in real app we might want to handle this better
      setShowPayment(true);
    }
  };

  if (showPayment) {
    return (
      <div className="min-h-screen py-12 px-4 flex flex-col items-center justify-start bg-[#fafaf9]">
        <div className="w-full max-w-lg flex flex-col items-center space-y-12">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white sketch-border-thick hard-shadow-xl p-8 w-full space-y-8"
          >
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold tracking-tight">Selesaikan Pembayaran</h2>
              <p className="text-gray-600 italic">Scan QRIS atau transfer ke nomor di bawah ini</p>
            </div>

            {/* QRIS Section */}
            <div className="bg-white p-6 sketch-border-thick hard-shadow flex flex-col items-center justify-center space-y-4">
               <div className="bg-sketch-blue px-4 py-1 sketch-border -rotate-2 font-bold mb-2 uppercase text-sm">
                  HENDRA STORE, HIBURAN
               </div>
               
               <div className="p-3 bg-white border-2 border-black flex items-center justify-center relative group">
                 <QRCodeSVG 
                   ref={qrRef}
                   value={dynamicQRIS} 
                   size={240}
                   level="Q"
                   includeMargin={false}
                 />
                 <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-black/10" />
               </div>
               
               <div className="text-center space-y-1 w-full">
                 <p className="text-sm font-medium text-gray-500 uppercase tracking-widest">Total Bayar</p>
                 <p className="font-bold text-3xl text-black">Rp {donationAmount.toLocaleString('id-ID')}</p>
                 
                 <button 
                  onClick={downloadQR}
                  className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 bg-sketch-blue text-white font-bold rounded-lg sketch-border hard-shadow hover:-translate-y-0.5 active:translate-y-0 transition-all uppercase text-xs"
                 >
                   <Download className="w-4 h-4" />
                   Download QRIS
                 </button>
               </div>

               <img src="https://upload.wikimedia.org/wikipedia/commons/a/a2/Logo_QRIS.svg" alt="QRIS Logo" className="h-6 object-contain" referrerPolicy="no-referrer" />
            </div>

            {/* Transfer Info */}
            <div className="space-y-4">
              {[
                { id: 'dana', logo: 'https://upload.wikimedia.org/wikipedia/commons/7/72/Logo_dana_blue.svg', number: '0851-3301-9413', h: 'h-6' },
                { id: 'gopay', logo: 'https://upload.wikimedia.org/wikipedia/commons/8/86/Gopay_logo.svg', number: '0851-3301-9413', h: 'h-5' },
                { id: 'ovo', logo: 'https://upload.wikimedia.org/wikipedia/commons/e/eb/Logo_ovo_purple.svg', number: '0838-9358-3450', h: 'h-6' },
                { id: 'bri', logo: 'https://upload.wikimedia.org/wikipedia/commons/9/97/Logo_BRI.png', number: '4797-0102-7692-508', h: 'h-6' }
              ].map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4 bg-white sketch-border hard-shadow">
                  <img src={item.logo} alt={item.id} className={`${item.h} w-12 object-contain`} referrerPolicy="no-referrer" />
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-end">
                      <span className="font-bold text-lg md:text-xl">{item.number}</span>
                    </div>
                    <button
                      onClick={() => {
                          navigator.clipboard.writeText(item.number.replace(/-/g, ''));
                          setCopiedId(item.id);
                          setTimeout(() => setCopiedId(null), 2000);
                      }}
                      className="p-2 sketch-border hover:bg-gray-100 transition-colors"
                    >
                      {copiedId === item.id ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button 
              onClick={() => {
                setShowPayment(false);
                setShowSuccess(true);
              }}
              className="w-full py-5 bg-sketch-pink sketch-border-thick hard-shadow-lg text-2xl font-bold hover:-translate-y-1 active:translate-y-1 active:hard-shadow-none transition-all"
            >
              Sudah Donasi
            </button>
          </motion.div>
          
          <footer className="w-full text-gray-400 font-medium text-sm text-center">
            © 2026 HenKarmazov — All rights reserved
          </footer>
        </div>
      </div>
    );
  }

  if (showSuccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-start py-20 bg-[#fafaf9]">
        <div className="w-full max-w-md flex flex-col items-center space-y-12">
          <motion.div 
            initial={{ scale: 0.8, rotate: -5, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            className="bg-white sketch-border-thick hard-shadow-xl p-8 w-full text-center space-y-6"
          >
            <div className="flex justify-center">
              <CheckCircle2 className="w-20 h-20 text-sketch-blue floating" />
            </div>
            <h1 className="text-4xl font-bold">Terima Kasih!</h1>
            <p className="text-xl">Dukunganmu sangat berarti bagi kami.</p>
            <div className="flex flex-col gap-4 w-full">
              <button 
                onClick={() => {
                  setShowSuccess(false);
                  setName('');
                  setEmail('');
                  setMessage('');
                  setCustomAmount('');
                  setIsConfirmed(false);
                }}
                className="w-full py-4 bg-sketch-pink sketch-border-thick hard-shadow-lg text-xl font-bold hover:-translate-y-1 active:translate-y-1 active:hard-shadow-none transition-all duration-75"
              >
                Kembali
              </button>
              <button 
  onClick={() => {
    window.location.replace('https://www.henkarmazov.my.id/');
  }}
  className="w-full py-4 bg-white sketch-border-thick hard-shadow-lg text-xl font-bold hover:-translate-y-1 active:translate-y-1 active:hard-shadow-none transition-all duration-75"
>
  Kembali ke <span className="text-sketch-blue">Hen</span><span className="text-sketch-pink">Veronime</span>
</button>
            </div>
          </motion.div>

          <footer className="w-full text-gray-400 font-medium text-sm text-center">
            © 2026 Henkaramazov — All rights reserved
          </footer>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 pt-20 md:pt-32 max-w-2xl mx-auto flex flex-col items-center">
      {/* Form Section */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full space-y-12"
      >
        <header className="space-y-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
            Kirim Dukungan Buat Developer <span className="text-sketch-blue">Hen</span><span className="text-sketch-pink">Veronime</span>
          </h1>
          <p className="text-xl text-gray-600 italic">Pilih jajanan atau masukkan jumlah yang kamu mau!</p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Donation Tiers */}
          <div>
            <label className="text-2xl font-bold block mb-4">Pilih Tiers</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {TIERS.map((tier) => (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setSelectedTier(tier.id)}
                  className={`
                    relative p-4 h-36 flex flex-col items-center justify-center gap-2
                    sketch-border-thick transition-all duration-75 group
                    ${selectedTier === tier.id ? `${tier.color} hard-shadow-lg scale-105` : 'bg-white hard-shadow hover:hard-shadow-lg hover:-translate-y-1'}
                  `}
                >
                  <div className={`transition-transform group-hover:scale-110 ${selectedTier === tier.id ? 'floating' : ''}`}>
                    {tier.icon}
                  </div>
                  <span className="text-lg font-bold">{tier.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Amount Field */}
          <AnimatePresence>
            {selectedTier === 'custom' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className={`relative bg-white p-4 sketch-border-thick hard-shadow ${errors.amount ? 'border-sketch-red jittery' : ''}`}>
                  <div className="absolute -top-3 -left-3 bg-sketch-pink px-3 py-1 sketch-border rotate-[-2deg] font-bold">
                    Jumlah (Rp)
                  </div>
                  <input
                    type="text"
                    value={customAmount}
                    onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        if (raw === '') {
                            setCustomAmount('');
                        } else {
                            const num = parseInt(raw);
                            if (!isNaN(num)) {
                                if (num > 20000000) {
                                    setCustomAmount((20000000).toLocaleString('id-ID'));
                                } else {
                                    setCustomAmount(num.toLocaleString('id-ID'));
                                }
                            }
                        }
                    }}
                    placeholder="Masukkan nominal..."
                    className="w-full text-2xl font-bold bg-transparent border-none outline-none mt-2"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Name & Email Group */}
          <div className="grid md:grid-cols-2 gap-8">
            {/* Name Input - Hello Sticker Style */}
            <div className={`relative bg-sketch-blue p-1 pt-8 sketch-border-thick hard-shadow ${errors.name ? 'border-sketch-red jittery' : ''}`}>
               <div className="absolute top-0 left-0 right-0 h-8 flex items-center justify-between px-4 bg-sketch-blue-dark border-b-2 border-black">
                  <span className="text-sm font-bold text-white uppercase tracking-widest">HELLO</span>
                  <button 
                    type="button" 
                    onClick={() => {
                        const nextPrivate = !isPrivate;
                        setIsPrivate(nextPrivate);
                        if (nextPrivate) {
                            setName('Someone');
                        } else if (name === 'Someone') {
                            setName('');
                        }
                    }}
                    className={`
                        text-[10px] font-bold px-2 py-0.5 sketch-border transition-all duration-75
                        ${isPrivate ? 'bg-white text-black -rotate-2 scale-110' : 'bg-white text-gray-400 opacity-60'}
                    `}
                  >
                    Sembunyikan Nama
                  </button>
               </div>
               <div className="bg-white p-4 pt-6 space-y-1">
                  <span className="text-xs font-bold text-gray-500 uppercase">My Name Is</span>
                  <input
                    value={name}
                    onChange={(e) => {
                        setName(e.target.value);
                        if (e.target.value !== 'Someone' && isPrivate) {
                            setIsPrivate(false);
                        }
                        if (e.target.value === 'Someone' && !isPrivate) {
                            setIsPrivate(true);
                        }
                    }}
                    placeholder="Nama Kamu"
                    className="w-full text-xl font-bold bg-transparent border-none outline-none"
                  />
               </div>
            </div>

            {/* Email Input - Washi Tape Style */}
            <div className="relative pt-6">
              <div className="absolute top-0 left-4 z-10 bg-[#e9d5ff] px-6 py-1 sketch-border rotate-[-1deg] hard-shadow-sm font-bold">
                Email
              </div>
              <div className={`bg-white p-6 sketch-border-thick hard-shadow ${errors.email ? 'border-sketch-red jittery' : ''}`}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="emailkamu@example.com"
                  className="w-full text-xl font-bold bg-transparent border-none outline-none"
                />
              </div>
            </div>
          </div>

          {/* Message Area - Scribble Note Style */}
          <div className="relative">
            <div className="absolute top-2 right-4 -rotate-2">
              <ScrollText className="w-8 h-8 opacity-20" />
            </div>
            <div className={`bg-sketch-yellow p-8 sketch-border-thick hard-shadow min-h-[150px] relative overflow-hidden`}>
              {/* Note Lines */}
              <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px)', backgroundSize: '100% 2.5rem' }} />
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Masukkan pesan dan saran untuk pengembang (developer)"
                className="w-full min-h-[120px] text-xl font-bold bg-transparent border-none outline-none relative z-10 resize-none"
              />
            </div>
          </div>

          {/* Confirmation Checkbox */}
          <div className={`flex items-start gap-3 p-4 bg-white sketch-border-thick hard-shadow transition-all ${errors.confirmation ? 'border-sketch-red jittery' : ''}`}>
             <div className="relative flex items-center h-6">
                <input
                  id="confirmation"
                  type="checkbox"
                  checked={isConfirmed}
                  onChange={(e) => setIsConfirmed(e.target.checked)}
                  className="w-6 h-6 sketch-border-thick cursor-pointer accent-black"
                />
             </div>
             <label htmlFor="confirmation" className="text-lg font-bold cursor-pointer select-none">
                Saya akan melanjutkan pembayaran dan memahami bahwa konfirmasi dilakukan secara manual.
             </label>
          </div>

          {/* Submit Button */}
          <div className="flex justify-center pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`
                group relative px-12 py-5 bg-sketch-pink sketch-border-thick hard-shadow-lg text-2xl font-bold
                transition-all duration-75 hover:-translate-y-1 active:translate-y-1 active:hard-shadow-none
                flex items-center gap-3 disabled:opacity-50
              `}
            >
              {isSubmitting ? 'Mengirim...' : 'Kirim Dukungan'}
            </button>
          </div>
        </form>

        {/* Footer Info & Warning */}
        <footer className="w-full pt-8 space-y-12">
          {/* Cara Donasi */}
          <div className="relative">
             <div className="absolute top-0 left-8 -translate-y-1/2 bg-sketch-pink px-4 py-1 sketch-border -rotate-1 font-bold z-10 uppercase tracking-wider">
                Cara Donasi
             </div>
             <div className="bg-white p-6 sketch-border-thick hard-shadow space-y-4 pt-10">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {[
                    { step: 1, title: 'Isi Data', desc: 'Masukkan nominal donasi, nama, email, serta pesan yang ingin disampaikan, lalu centang konfirmasi donasi.' },
                    { 
                      step: 2, 
                      title: 'Kirim Dukungan', 
                      desc: (
                        <>
                          Klik tombol <span className="inline-block px-2 py-0.5 bg-sketch-pink sketch-border text-[10px] font-bold uppercase mx-1 text-black">Kirim Dukungan</span> untuk melanjutkan ke proses pembayaran.
                        </>
                      )
                    },
                    { step: 3, title: 'QRIS Ditampilkan', desc: 'Lakukan pemindaian kode QRIS Dinamis yang muncul menggunakan e-wallet atau mobile banking (seperti DANA, GoPay, OVO, dan lainnya).' },
                    { 
                      step: 4, 
                      title: 'Selesai', 
                      desc: (
                        <>
                          Setelah pembayaran berhasil, klik tombol <span className="inline-block px-2 py-0.5 bg-sketch-pink sketch-border text-[10px] font-bold uppercase mx-1 text-black">Sudah Donasi</span>. Pesan dan dukungan Anda akan diterima oleh sistem.
                        </>
                      )
                    }
                  ].map((item) => (
                    <div key={item.step} className="flex gap-4 items-start">
                      <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center flex-shrink-0 font-bold -rotate-3">
                        {item.step}
                      </div>
                      <div>
                        <div className="font-bold text-lg mb-1">{item.title}</div>
                        <div className="text-gray-600 text-sm leading-relaxed">{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
             </div>
          </div>

          {/* Payment Info */}
          <div className="relative">
             <div className="absolute top-0 right-8 -translate-y-1/2 bg-sketch-blue px-4 py-1 sketch-border rotate-2 font-bold z-10 uppercase tracking-wider">
                Informasi Pembayaran
             </div>
             <div className="bg-white p-6 sketch-border-thick hard-shadow space-y-4 pt-10">
                <ul className="space-y-4">
                  <li className="flex gap-3 items-start">
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-black flex-shrink-0" />
                    <div>
                      <p className="text-lg text-gray-800">
                        Pembayaran dilakukan menggunakan layanan e-banking seperti QRIS, DANA, GoPay, dan lainnya.
                      </p>
                      <div className="flex flex-wrap gap-4 mt-2 items-center">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/a/a2/Logo_QRIS.svg" alt="QRIS" className="h-5 object-contain" referrerPolicy="no-referrer" />
                        <img src="https://upload.wikimedia.org/wikipedia/commons/7/72/Logo_dana_blue.svg" alt="DANA" className="h-3.5 object-contain" referrerPolicy="no-referrer" />
                        <img src="https://upload.wikimedia.org/wikipedia/commons/8/86/Gopay_logo.svg" alt="GoPay" className="h-3.5 object-contain" referrerPolicy="no-referrer" />
                      </div>
                    </div>
                  </li>
                  <li className="flex gap-3 items-start">
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-black flex-shrink-0" />
                    <p className="text-lg text-gray-800">
                      Sistem ini tidak memiliki fitur untuk mendeteksi pembayaran secara otomatis. Namun, kami tetap dapat mengetahui adanya pembayaran melalui pengecekan manual.
                    </p>
                  </li>
                  <li className="flex gap-3 items-start">
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-black flex-shrink-0" />
                    <p className="text-lg text-gray-800">
                      Data yang dikirim seperti nama, email, jumlah donasi, dan pesan akan diterima secara real-time oleh sistem.
                    </p>
                  </li>
                </ul>
             </div>
          </div>

          {/* Warning Section */}
          <div className="relative">
             <div className="absolute top-0 right-8 -translate-y-1/2 bg-sketch-red text-white px-4 py-1 sketch-border -rotate-2 font-bold z-10 uppercase tracking-wider">
                Peringatan
             </div>
             <div className="bg-white p-6 sketch-border-thick hard-shadow space-y-4 pt-10">
                <ul className="space-y-4">
                  <li className="flex gap-3 items-start">
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-sketch-red flex-shrink-0" />
                    <p className="text-lg text-gray-800 font-bold italic">
                      Kami mohon untuk tidak melakukan spam atau pengiriman data secara berulang-ulang tanpa tujuan yang jelas.
                    </p>
                  </li>
                  <li className="flex gap-3 items-start">
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-sketch-red flex-shrink-0" />
                    <p className="text-lg text-gray-800">
                      Tindakan spam dapat menyebabkan gangguan pada sistem, memperlambat performa website, serta menyulitkan proses pengecekan data yang valid.
                    </p>
                  </li>
                  <li className="flex gap-3 items-start">
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-sketch-red flex-shrink-0" />
                    <p className="text-lg text-gray-800">
                      Jika ditemukan aktivitas spam yang berlebihan, kami berhak untuk mengabaikan, menghapus data, atau membatasi akses pengguna demi menjaga kestabilan sistem.
                    </p>
                  </li>
                </ul>
             </div>
          </div>
        </footer>

        <footer className="py-12 w-full text-gray-400 font-medium text-sm text-center border-t border-black/5 mt-8">
          © 2026 Henkaramazov — All rights reserved
        </footer>
      </motion.div>
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Upload, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { nova } from '@/api/novaClient';
import { ClothingItem } from '@/types/clothing';
import Image from 'next/image';

export default function CameraCapture({ onCapture, onClose }: { onCapture: any; onClose: any }) {
  const [preview, setPreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detectedItems, setDetectedItems] = useState<ClothingItem[]>([]);
  const [editingItem, setEditingItem] = useState<ClothingItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileSelect = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => setPreview(e.target.result);
    reader.readAsDataURL(file);

    setIsUploading(true);
    const { file_url } = await nova.integrations.Core.UploadFile({ _file: file });
    setIsUploading(false);

    setIsAnalyzing(true);
    const processedItems = await nova.integrations.Core.invokeClothesProcesser({
      image_url: file_url,
    });

    setDetectedItems(processedItems);
    setIsAnalyzing(false);
  };

  //   const handleFileSelect = async (e) => {
  //   const file = e.target.files?.[0];
  //   if (!file) return;

  //   const reader = new FileReader();
  //   reader.onload = (e) => setPreview(e.target.result);
  //   reader.readAsDataURL(file);

  //   setIsUploading(true);
  //   const { file_url } = await base44.integrations.Core.UploadFile({ file });
  //   setIsUploading(false);

  //   setIsAnalyzing(true);

  //   // Simulate outfit analysis with realistic items
  //   await new Promise(resolve => setTimeout(resolve, 1500));

  //   const simulatedItems = [
  //     {
  //       name: "Classic White Cotton T-Shirt",
  //       category: "tops",
  //       color: "White",
  //       brand: "Uniqlo",
  //       image_url: file_url
  //     },
  //     {
  //       name: "Dark Wash Slim Fit Jeans",
  //       category: "bottoms",
  //       color: "Blue",
  //       brand: "Levi's",
  //       image_url: file_url
  //     },
  //     {
  //       name: "Black Leather Sneakers",
  //       category: "shoes",
  //       color: "Black",
  //       brand: "Adidas",
  //       image_url: file_url
  //     }
  //   ];

  //   setDetectedItems(simulatedItems);
  //   setIsAnalyzing(false);
  // };

  const handleConfirm = () => {
    onCapture(detectedItems);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-stone-100 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-stone-900">Capture Outfit</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {!preview ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="aspect-[3/4] rounded-2xl border-2 border-dashed border-stone-200 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-[#C9A484] hover:bg-stone-50 transition-all"
            >
              <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center">
                <Camera className="w-8 h-8 text-stone-400" />
              </div>
              <div className="text-center">
                <p className="font-medium text-stone-700">Take or upload a photo</p>
                <p className="text-sm text-stone-500 mt-1">
                  We&apos;ll identify your clothing items
                </p>
              </div>
              <Button variant="outline" className="gap-2">
                <Upload className="w-4 h-4" />
                Choose Photo
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="aspect-[3/4] rounded-2xl overflow-hidden bg-stone-100">
                <Image
                  src={preview}
                  alt="Preview"
                  width={300}
                  height={400}
                  className="w-full h-full object-cover"
                />
              </div>

              {(isUploading || isAnalyzing) && (
                <div className="flex items-center justify-center gap-3 py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-[#C9A484]" />
                  <span className="text-stone-600">
                    {isUploading ? 'Uploading...' : 'Analyzing your outfit...'}
                  </span>
                </div>
              )}

              <AnimatePresence>
                {detectedItems.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                  >
                    <h3 className="font-medium text-stone-900">Detected Items</h3>
                    {detectedItems.map((item: any, idx: any) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl cursor-pointer hover:bg-stone-100 transition-colors"
                        onClick={() => setEditingItem(item)}
                      >
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-10 h-10 rounded-lg"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-stone-900">{item.name}</p>
                          <p className="text-sm text-stone-500 capitalize">{item.category}</p>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        <div className="p-6 border-t border-stone-100 flex gap-3">
          {preview && (
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setPreview(null);
                setDetectedItems([]);
              }}
            >
              Retake
            </Button>
          )}
          <Button
            className="flex-1 bg-stone-900 hover:bg-stone-800"
            disabled={detectedItems.length === 0}
            onClick={handleConfirm}
          >
            Add to Wardrobe
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

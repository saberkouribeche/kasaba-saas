// src/context/CartContext.js
"use client";
import { createContext, useContext, useState, useEffect } from "react";

const CartContext = createContext();

export function CartProvider({ children }) {
  /* State */
  const [cart, setCart] = useState([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // استرجاع السلة من الذاكرة عند التحميل
  useEffect(() => {
    const savedCart = localStorage.getItem("kasaba_cart");
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (error) {
        console.error("Failed to parse cart", error);
      }
    }
    setIsInitialized(true);
  }, []);

  // حفظ السلة عند أي تغيير
  useEffect(() => {
    if (!isInitialized) return;
    localStorage.setItem("kasaba_cart", JSON.stringify(cart));
  }, [cart, isInitialized]);

  // إضافة منتج
  const addToCart = (product, quantity = 1, options = null, openDrawer = true) => {
    setCart((prev) => {
      // البحث هل المنتج موجود مسبقاً بنفس الخيارات؟
      const existingItem = prev.find(
        (item) => item.id === product.id && JSON.stringify(item.options) === JSON.stringify(options)
      );

      if (existingItem) {
        return prev.map((item) =>
          item.id === product.id && JSON.stringify(item.options) === JSON.stringify(options)
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { ...product, quantity, options }];
    });

    // Pixel: AddToCart
    import('react-facebook-pixel')
      .then((x) => x.default)
      .then((ReactPixel) => {
        ReactPixel.track('AddToCart', {
          content_name: product.title,
          content_ids: [product.id],
          content_type: 'product',
          value: product.price,
          currency: 'DZD'
        });
      });

    if (openDrawer) setIsDrawerOpen(true); // فتح السلة تلقائياً عند الإضافة إذا طلب ذلك
  };

  // حذف منتج
  const removeFromCart = (index) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  // حساب المجموع
  const cartTotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  const cartCount = cart.reduce((count, item) => count + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cart, addToCart, removeFromCart, cartTotal, cartCount,
        isDrawerOpen, setIsDrawerOpen,
        setCart
      }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
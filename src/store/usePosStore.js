import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const usePosStore = create(
    persist(
        (set, get) => ({
            cart: [],
            parkedOrders: [],
            selectedCustomer: null,
            isWeightModalOpen: false,
            tempProduct: null,

            // Cart Actions
            addToCart: (product, weight = null, quantity = 1) => {
                set((state) => {
                    const cart = [...state.cart];
                    // If weight is provided, we treat it as a unique item based on ID + Weight to avoid merging different weights? 
                    // OR we just merge if same product and same unit?
                    // For "Sold by weight", usually quantity is 1 and weight is X.
                    // For "Sold by unit", quantity is X.

                    const isByWeight = weight !== null;

                    if (isByWeight) {
                        // Weight Item
                        cart.push({
                            ...product,
                            cartId: `${product.id}-${Date.now()}`,
                            weight: parseFloat(weight),
                            price: product.price,
                            totalPrice: product.price * parseFloat(weight),
                            quantity: 1,
                            isWeight: true
                        });
                    } else {
                        // Unit product logic - DISABLED MERGING as per request
                        // Always add as new line item
                        cart.push({
                            ...product,
                            cartId: `${product.id}-${Date.now()}`, // Unique ID for every entry
                            quantity: quantity,
                            totalPrice: product.price * quantity,
                            isWeight: false
                        });
                    }
                    return { cart };
                });
            },

            removeFromCart: (cartId) => {
                set((state) => ({
                    cart: state.cart.filter((item) => item.cartId !== cartId),
                }));
            },

            updateQuantity: (cartId, delta) => {
                set((state) => {
                    const cart = state.cart.map((item) => {
                        if (item.cartId === cartId) {
                            if (item.isWeight) return item; // Don't change qty for weight items via +/- buttons usually, or maybe yes?
                            // Let's assume standard qty update for unit items.
                            const newQty = Math.max(1, item.quantity + delta);
                            return { ...item, quantity: newQty, totalPrice: item.price * newQty };
                        }
                        return item;
                    });
                    return { cart };
                });
            },

            clearCart: () => set({ cart: [], selectedCustomer: null }),

            // Parking
            parkOrder: () => {
                const { cart, selectedCustomer } = get();
                if (cart.length === 0) return;
                set((state) => ({
                    parkedOrders: [...state.parkedOrders, {
                        id: Date.now(),
                        cart,
                        customer: selectedCustomer,
                        date: new Date().toISOString()
                    }],
                    cart: [],
                    selectedCustomer: null
                }));
            },

            retrieveOrder: (parkedOrderId) => {
                set((state) => {
                    const orderToRetrieve = state.parkedOrders.find(o => o.id === parkedOrderId);
                    if (!orderToRetrieve) return {};
                    return {
                        cart: orderToRetrieve.cart,
                        selectedCustomer: orderToRetrieve.customer,
                        parkedOrders: state.parkedOrders.filter(o => o.id !== parkedOrderId)
                    };
                });
            },

            removeParkedOrder: (id) => {
                set(state => ({ parkedOrders: state.parkedOrders.filter(p => p.id !== id) }));
            },

            // Customer
            setCustomer: (customer) => set({ selectedCustomer: customer }),

            // Modal
            openWeightModal: (product) => set({ isWeightModalOpen: true, tempProduct: product }),
            closeWeightModal: () => set({ isWeightModalOpen: false, tempProduct: null }),

        }),
        {
            name: 'kasaba-pos-storage', // name of the item in the storage (must be unique)
            partialize: (state) => ({ parkedOrders: state.parkedOrders }), // Only persist parked orders? Or maybe cart too? Let's persist cart too for crash recovery.
        }
    )
);

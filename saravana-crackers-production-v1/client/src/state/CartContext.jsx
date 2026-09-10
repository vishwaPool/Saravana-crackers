import React, { createContext, useContext, useMemo, useState } from "react";

const CartContext = createContext();

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);

  const addItem = (product) => {
    if (!product || !Number.isInteger(Number(product.stock)) || Number(product.stock) <= 0) return;
    setItems((current) => {
      const existing = current.find((item) => item.id === product.id);

      if (existing) {
        return current.map((item) =>
          item.id === product.id
            ? { ...item, quantity: Math.min(item.quantity + 1, Number(product.stock)) }
            : item
        );
      }

      return [...current, { ...product, quantity: 1 }];
    });
  };

  const removeItem = (productId) => {
    setItems((current) =>
      current.filter((item) => item.id !== productId)
    );
  };

  const updateQuantity = (productId, quantity) => {
    quantity = Number(quantity);
    if (!Number.isInteger(quantity)) return;
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }

    setItems((current) =>
      current.map((item) =>
        item.id === productId
          ? { ...item, quantity: Math.min(quantity, Number(item.stock)) }
          : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const total = useMemo(() => {
    return items.reduce(
      (sum, item) =>
        sum + Number(item.retailPrice || 0) * item.quantity,
      0
    );
  }, [items]);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        total,
        add: addItem,
        qty: updateQuantity,
        clear: clearCart,
        count: items.reduce((sum, item) => sum + item.quantity, 0),
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}

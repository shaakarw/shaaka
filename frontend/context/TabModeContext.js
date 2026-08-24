import React, { createContext, useState, useContext } from 'react';

const TabModeContext = createContext();

export const TabModeProvider = ({ children }) => {
  // Modes:
  // 'shopMode' → shows Search & BuyPost in bottom tabs
  // 'locateMode' → shows Locate & AddShop in bottom tabs
  const [tabMode, setTabMode] = useState('shopMode');

  return (
    <TabModeContext.Provider value={{ tabMode, setTabMode }}>
      {children}
    </TabModeContext.Provider>
  );
};

export const useTabMode = () => useContext(TabModeContext);
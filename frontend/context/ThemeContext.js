import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Simple theme colors (no nested objects)
export const lightTheme = {
  background: '#dddddd',
  mediaLoadingBackground: '#f0efefdd',
  text: '#111',
  textSecondary: '#666666',
  back: '#9c9c9c00',
  border: '#bebebe',
  accent: '#272727',
  more: '#111',
  send: '#111',
  curve: '#dddddd',
  Color: '#111',
  select:'#5e5e5e',
  login:'#47ae87',
  register:'#dddddd',
  home:'#666666',
  report:'#111',
  more:'#111',
  message:'transparent',
  reply:'#8fb59a',
  chat:'#ddddddf1',
  action:'rgba(225, 225, 225, 0.73)',
  image:'rgba(225, 225, 225, 0.88)',
  buttons:'rgba(76, 76, 76, 0.07)',
  top:'#dddddd',
  nice:'#0000',
  search:'#e4e4e4ce',
  title:'#ffff',
};

export const darkTheme = {
  mediaLoadingBackground: '#151515',
  select:'#000',
  background: '#111',
  text: '#FFFFFF',
  textSecondary: '#888888',
  back: '#111',
  border: '#333333',
  accent: '#888888',
  more: '#FFFFFF',
  send: '#FFFFFF',
  curve: '#111',
  Color: '#111',
  login: '#47ae87',
  register:'#00030b',
  home:'#ffffff',
  report:'#ffffff',
  more:'#ffffff',
  message:'transparent',
  reply:'#baf9cd',
  chart:'#11100',
  action:'rgba(0, 0, 0, 0.5)',
  image:'rgba(0, 0, 0, 0.88)',
  buttons:'rgba(19, 19, 19, 0.36)',
  top:'#111',
  nice:'#0000',
  search:'#e4e4e4ce',
  title:'#ffff',
};

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    const loadingTimeout = setTimeout(() => setIsLoading(false), 3000);
    try {
      const saved = await AsyncStorage.getItem('isDarkMode');
      if (saved !== null) setIsDarkMode(JSON.parse(saved));
    } catch (error) {
      console.error(error);
    } finally {
      clearTimeout(loadingTimeout);
      setIsLoading(false);
    }
  };

  const toggleTheme = async () => {
    const newValue = !isDarkMode;
    setIsDarkMode(newValue);
    await AsyncStorage.setItem('isDarkMode', JSON.stringify(newValue));
  };

  const theme = isDarkMode ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ theme, isDarkMode, toggleTheme, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
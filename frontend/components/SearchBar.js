// components/SearchBar.js
import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Text,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import axios from 'axios';

const OPENCAGE_API_KEY = 'YOUR_OPENCAGE_API_KEY'; // Replace with your key

export default function SearchBar({ onClose, onSelectLocation, language = 'English' }) {
  const { theme } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  const searchLocation = async (text) => {
    setQuery(text);
    if (text.length < 3) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(
        `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(text + ', Rwanda')}&key=${OPENCAGE_API_KEY}&countrycode=rw&limit=10`
      );
      
      const filteredResults = response.data.results.filter(
        result => result.components.country === 'Rwanda'
      );
      
      setResults(filteredResults);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (item) => {
    onSelectLocation({
      lat: item.geometry.lat,
      lng: item.geometry.lng,
      name: item.formatted,
    });
    setQuery('');
    setResults([]);
    Keyboard.dismiss();
    onClose();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.searchContainer, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: theme.text }]}
          placeholder={language === 'English' ? "Search in Rwanda..." : "Shakisha mu Rwanda..."}
          placeholderTextColor={theme.textSecondary}
          value={query}
          onChangeText={searchLocation}
          autoFocus
          returnKeyType="search"
        />
        
        {loading && <ActivityIndicator size="small" color={theme.accent} style={styles.loader} />}
      </View>
      
      <FlatList
        data={results}
        keyExtractor={(item) => item.geometry.lat + item.geometry.lng}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.resultItem, { borderBottomColor: theme.border }]}
            onPress={() => handleSelect(item)}
          >
            <Ionicons name="location-outline" size={20} color={theme.textSecondary} />
            <View style={styles.resultTextContainer}>
              <Text style={[styles.resultText, { color: theme.text }]} numberOfLines={1}>
                {item.formatted}
              </Text>
              <Text style={[styles.resultSubtext, { color: theme.textSecondary }]} numberOfLines={1}>
                {item.components.city || item.components.town || item.components.village}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.resultsList}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    height: 50,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  loader: {
    marginLeft: 8,
  },
  resultsList: {
    paddingHorizontal: 16,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    gap: 12,
  },
  resultTextContainer: {
    flex: 1,
  },
  resultText: {
    fontSize: 14,
  },
  resultSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
});
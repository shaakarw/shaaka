import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  Image,
  FlatList,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export default function ShopDetailsModal({ visible, shop, onClose, onEdit, onDelete, currentUserId }) {
  const { theme } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [editedShop, setEditedShop] = useState(null);
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');

  React.useEffect(() => {
    if (shop) {
      setEditedShop({ ...shop });
    }
  }, [shop]);

  if (!shop) return null;

  const isOwner = true; // Replace with actual owner check

  const handleEdit = () => {
    if (isEditing) {
      onEdit(editedShop);
      setIsEditing(false);
    } else {
      setIsEditing(true);
    }
  };

  const handleDelete = () => {
    onDelete(shop.id);
  };

  const addProduct = () => {
    if (!newProductName.trim()) return;
    
    const newProduct = {
      id: Date.now().toString(),
      name: newProductName,
      price: newProductPrice ? parseFloat(newProductPrice) : null,
    };
    
    setEditedShop({
      ...editedShop,
      products: [...(editedShop.products || []), newProduct],
    });
    setNewProductName('');
    setNewProductPrice('');
  };

  const removeProduct = (productId) => {
    setEditedShop({
      ...editedShop,
      products: editedShop.products.filter(p => p.id !== productId),
    });
  };

  const renderProduct = ({ item }) => (
    <View style={[styles.productCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
      <View style={styles.productInfo}>
        <Text style={[styles.productName, { color: theme.text }]}>{item.name}</Text>
        {item.price && <Text style={[styles.productPrice, { color: theme.accent }]}>RWF {item.price.toLocaleString()}</Text>}
      </View>
      {isEditing && (
        <TouchableOpacity onPress={() => removeProduct(item.id)}>
          <Ionicons name="trash-outline" size={20} color="#ff3b30" />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderImage = ({ item, index }) => (
    <Image source={{ uri: item }} style={styles.galleryImage} />
  );

  const currentShop = isEditing ? editedShop : shop;

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={styles.modalHeader}>
            {isEditing ? (
              <TextInput
                style={[styles.editTitleInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.cardBackground }]}
                value={editedShop.name}
                onChangeText={(text) => setEditedShop({ ...editedShop, name: text })}
              />
            ) : (
              <Text style={[styles.modalTitle, { color: theme.text }]}>{currentShop.name}</Text>
            )}
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Category Badge */}
            <View style={[styles.categoryBadge, { backgroundColor: theme.accent + '20' }]}>
              <Ionicons name="storefront-outline" size={16} color={theme.accent} />
              <Text style={[styles.categoryText, { color: theme.accent }]}>{currentShop.category}</Text>
            </View>

            {/* Image Gallery */}
            {currentShop.images && currentShop.images.length > 0 && (
              <FlatList
                data={currentShop.images}
                horizontal
                showsHorizontalScrollIndicator={false}
                renderItem={renderImage}
                keyExtractor={(_, index) => index.toString()}
                contentContainerStyle={styles.galleryContainer}
              />
            )}

            {/* Description */}
            {isEditing ? (
              <TextInput
                style={[styles.editDescriptionInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.cardBackground }]}
                value={editedShop.description}
                onChangeText={(text) => setEditedShop({ ...editedShop, description: text })}
                multiline
                numberOfLines={3}
              />
            ) : (
              <Text style={[styles.description, { color: theme.textSecondary }]}>{currentShop.description}</Text>
            )}

            {/* Location */}
            <View style={styles.locationContainer}>
              <Ionicons name="location-outline" size={16} color={theme.textSecondary} />
              <Text style={[styles.locationText, { color: theme.textSecondary }]}>
                Lat: {currentShop.latitude.toFixed(4)}, Lng: {currentShop.longitude.toFixed(4)}
              </Text>
            </View>

            {/* Products Section */}
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Products</Text>
            
            {isEditing && (
              <View style={styles.addProductRow}>
                <TextInput
                  style={[styles.productInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.cardBackground }]}
                  placeholder="Product name"
                  placeholderTextColor={theme.textSecondary}
                  value={newProductName}
                  onChangeText={setNewProductName}
                />
                <TextInput
                  style={[styles.productPriceInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.cardBackground }]}
                  placeholder="Price"
                  placeholderTextColor={theme.textSecondary}
                  value={newProductPrice}
                  onChangeText={setNewProductPrice}
                  keyboardType="numeric"
                />
                <TouchableOpacity style={[styles.addProductBtn, { backgroundColor: theme.accent }]} onPress={addProduct}>
                  <Ionicons name="add" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            )}

            {currentShop.products && currentShop.products.length > 0 ? (
              <FlatList
                data={currentShop.products}
                renderItem={renderProduct}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
              />
            ) : (
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No products listed</Text>
            )}

            {/* Rating Section (Bonus) */}
            {currentShop.rating > 0 && (
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={16} color="#FFD700" />
                <Text style={[styles.ratingText, { color: theme.text }]}>{currentShop.rating.toFixed(1)}</Text>
                <Text style={[styles.reviewCount, { color: theme.textSecondary }]}>
                  ({currentShop.reviews?.length || 0} reviews)
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Action Buttons */}
          {isOwner && (
            <View style={styles.modalFooter}>
              <TouchableOpacity style={[styles.editBtn, { borderColor: theme.border }]} onPress={handleEdit}>
                <Ionicons name={isEditing ? "save-outline" : "create-outline"} size={20} color={theme.text} />
                <Text style={[styles.editBtnText, { color: theme.text }]}>{isEditing ? 'Save' : 'Edit'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.deleteBtn, { borderColor: '#ff3b30' }]} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={20} color="#ff3b30" />
                <Text style={[styles.deleteBtnText, { color: '#ff3b30' }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    maxHeight: '80%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  editTitleInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginRight: 12,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    marginBottom: 16,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '500',
  },
  galleryContainer: {
    marginBottom: 16,
  },
  galleryImage: {
    width: 120,
    height: 120,
    borderRadius: 8,
    marginRight: 8,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  editDescriptionInput: {
    fontSize: 14,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  locationText: {
    fontSize: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  addProductRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  productInput: {
    flex: 2,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
  },
  productPriceInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
  },
  addProductBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '500',
  },
  productPrice: {
    fontSize: 12,
    marginTop: 2,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  reviewCount: {
    fontSize: 12,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 0.5,
    borderTopColor: '#e0e0e0',
  },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  editBtnText: {
    fontSize: 14,
    fontWeight: '500',
  },
  deleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
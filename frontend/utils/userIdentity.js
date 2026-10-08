export const getUserDisplayName = (user, fallback = 'User') => {
  if (!user || typeof user !== 'object') {
    return fallback;
  }

  const rawName = [
    user.name,
    user.displayName,
    user.fullName,
    user.profileName,
    user.ownerName,
  ].find((value) => typeof value === 'string' && value.trim());

  if (rawName) {
    const trimmed = rawName.trim();
    if (trimmed) return trimmed;
  }

  const firstName = typeof user.firstName === 'string' ? user.firstName.trim() : '';
  const lastName = typeof user.lastName === 'string' ? user.lastName.trim() : '';
  if (firstName || lastName) {
    return `${firstName} ${lastName}`.trim();
  }

  const username = typeof user.username === 'string' ? user.username.trim() : '';
  if (username) return username;

  return fallback;
};

export const resolveUserIdentity = (user, fallback = 'User') => {
  const displayName = getUserDisplayName(user, fallback);
  return {
    displayName,
    username: typeof user?.username === 'string' ? user.username.trim() : '',
    avatar: user?.avatar || '',
  };
};

export const resolveEntityUser = (entity) => {
  if (!entity || typeof entity !== 'object') return null;

  const userCandidates = [
    entity.user,
    entity.userData,
    entity.userDetails,
    entity.seller,
    entity.owner,
    entity.author,
    entity.farmer,
    entity.buyer,
    entity.sender,
    entity.receiver,
    entity.createdBy,
    entity.postedBy,
    entity.ownerInfo,
    entity.sellerInfo,
    entity.currentUser,
  ];

  return userCandidates.find(Boolean) || null;
};

export const resolveEntityDisplayName = (entity, fallback = 'User') => {
  const user = resolveEntityUser(entity);
  if (user) return getUserDisplayName(user, fallback);

  const copiedName = [
    entity?.sellerName,
    entity?.ownerName,
    entity?.authorName,
    entity?.farmerName,
    entity?.buyerName,
    entity?.senderName,
    entity?.receiverName,
    entity?.createdByName,
    entity?.postedByName,
    entity?.displayName,
    entity?.fullName,
    entity?.name,
    entity?.username,
  ].find((value) => typeof value === 'string' && value.trim());

  return copiedName ? copiedName.trim() : fallback;
};

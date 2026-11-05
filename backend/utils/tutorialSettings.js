const parseTutorialSections = (value) => {
  if (!value) return [];

  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [{
      id: 'tutorial',
      title: 'Tutorial',
      images: [{ storageKey: value }],
    }];
  }

  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.sections)) {
    throw new Error('Stored tutorial sections have an invalid format.');
  }

  return parsed.sections;
};

const serializeTutorialSections = (sections) => JSON.stringify({
  version: 1,
  sections: sections.map(section => ({
    id: section.id,
    title: section.title,
    images: section.images.map(image => ({ storageKey: image.storageKey })),
  })),
});

const getTutorialStorageKeys = (sections) => (
  sections.flatMap(section => section.images.map(image => image.storageKey))
);

module.exports = {
  getTutorialStorageKeys,
  parseTutorialSections,
  serializeTutorialSections,
};

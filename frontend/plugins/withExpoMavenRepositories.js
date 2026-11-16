const { withSettingsGradle } = require('@expo/config-plugins');

const REPOSITORY_CONFIG = `def expoAutolinkingConfig = gradle.extensions.getByName("expoGradle").config
def expoLocalMavenPublications = expoAutolinkingConfig.allProjects.findAll { moduleProject ->
  moduleProject.usePublication && moduleProject.publication?.repository != "mavenLocal"
}

dependencyResolutionManagement {
  repositoriesMode.set(RepositoriesMode.PREFER_SETTINGS)
  repositories {
    google()
    mavenCentral()
    maven { url = uri("https://www.jitpack.io") }
    expoLocalMavenPublications.each { moduleProject ->
      def repositoryPath = new File(moduleProject.sourceDir, "../\${moduleProject.publication.repository}")
      maven {
        url = uri(repositoryPath)
        content {
          includeVersion(
            moduleProject.publication.groupId,
            moduleProject.publication.artifactId,
            moduleProject.publication.version
          )
        }
      }
    }
  }
}`;

const withExpoMavenRepositories = config =>
  withSettingsGradle(config, modConfig => {
    const contents = modConfig.modResults.contents;
    if (contents.includes('def expoLocalMavenPublications =')) {
      return modConfig;
    }

    const autolinkingAnchor = 'expoAutolinking.useExpoModules()';
    if (!contents.includes(autolinkingAnchor)) {
      throw new Error('Unable to configure Android repositories: Expo autolinking setup was not found in settings.gradle.');
    }

    modConfig.modResults.contents = contents.replace(
      autolinkingAnchor,
      `${autolinkingAnchor}\n${REPOSITORY_CONFIG}`
    );
    return modConfig;
  });

module.exports = withExpoMavenRepositories;

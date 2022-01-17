import { getPackageJson, PackageJSONConfig } from '@expo/config';
import JsonFile from '@expo/json-file';
import * as PackageManager from '@expo/package-manager';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';

import * as Log from '../log';
import { hashForDependencyMap } from '../prebuild/updatePackageJson';
import { EXPO_DEBUG } from './env';
import { AbortCommandError } from './errors';
import { logNewSection } from './ora';

function getTempPrebuildFolder(projectRoot: string) {
  return path.join(projectRoot, '.expo', 'prebuild');
}

type PackageChecksums = {
  dependencies: string;
  devDependencies: string;
};

function hasNewDependenciesSinceLastBuild(projectRoot: string, packageChecksums: PackageChecksums) {
  // TODO: Maybe comparing lock files would be better...
  const tempDir = getTempPrebuildFolder(projectRoot);
  const tempPkgJsonPath = path.join(tempDir, 'cached-packages.json');
  if (!fs.pathExistsSync(tempPkgJsonPath)) {
    return true;
  }
  const { dependencies, devDependencies } = JsonFile.read(tempPkgJsonPath);
  // Only change the dependencies if the normalized hash changes, this helps to reduce meaningless changes.
  const hasNewDependencies = packageChecksums.dependencies !== dependencies;
  const hasNewDevDependencies = packageChecksums.devDependencies !== devDependencies;

  return hasNewDependencies || hasNewDevDependencies;
}

function createPackageChecksums(pkg: PackageJSONConfig): PackageChecksums {
  return {
    dependencies: hashForDependencyMap(pkg.dependencies || {}),
    devDependencies: hashForDependencyMap(pkg.devDependencies || {}),
  };
}

export async function hasPackageJsonDependencyListChangedAsync(projectRoot: string) {
  const pkg = getPackageJson(projectRoot);

  const packages = createPackageChecksums(pkg);
  const hasNewDependencies = hasNewDependenciesSinceLastBuild(projectRoot, packages);

  // Cache package.json
  const tempDir = path.join(getTempPrebuildFolder(projectRoot), 'cached-packages.json');
  await fs.ensureFile(tempDir);
  await JsonFile.writeAsync(tempDir, packages);

  return hasNewDependencies;
}

function doesProjectUseCocoaPods(projectRoot: string): boolean {
  return fs.existsSync(path.join(projectRoot, 'ios', 'Podfile'));
}

function isLockfileCreated(projectRoot: string): boolean {
  const podfileLockPath = path.join(projectRoot, 'ios', 'Podfile.lock');
  return fs.existsSync(podfileLockPath);
}

function isPodFolderCreated(projectRoot: string): boolean {
  const podFolderPath = path.join(projectRoot, 'ios', 'Pods');
  return fs.existsSync(podFolderPath);
}

// TODO: Same process but with app.config changes + default plugins.
// This will ensure the user is prompted for extra setup.
export default async function maybePromptToSyncPodsAsync(projectRoot: string) {
  if (!doesProjectUseCocoaPods(projectRoot)) {
    // Project does not use CocoaPods
    return;
  }
  if (!isLockfileCreated(projectRoot) || !isPodFolderCreated(projectRoot)) {
    if (!(await installCocoaPodsAsync(projectRoot))) {
      throw new AbortCommandError();
    }
    return;
  }

  // Getting autolinked packages can be heavy, optimize around checking every time.
  if (!(await hasPackageJsonDependencyListChangedAsync(projectRoot))) {
    return;
  }

  await promptToInstallPodsAsync(projectRoot, []);
}

async function promptToInstallPodsAsync(projectRoot: string, missingPods?: string[]) {
  if (missingPods?.length) {
    Log.log(
      `Could not find the following native modules: ${missingPods
        .map((pod) => chalk.bold(pod))
        .join(', ')}. Did you forget to run "${chalk.bold('pod install')}" ?`
    );
  }

  try {
    if (!(await installCocoaPodsAsync(projectRoot))) {
      throw new AbortCommandError();
    }
  } catch (error) {
    fs.removeSync(path.join(getTempPrebuildFolder(projectRoot), 'cached-packages.json'));
    throw error;
  }
}

export async function installCocoaPodsAsync(projectRoot: string) {
  let step = logNewSection('Installing CocoaPods...');
  if (process.platform !== 'darwin') {
    step.succeed('Skipped installing CocoaPods because operating system is not on macOS.');
    return false;
  }

  const packageManager = new PackageManager.CocoaPodsPackageManager({
    cwd: path.join(projectRoot, 'ios'),
    silent: !EXPO_DEBUG,
  });

  if (!(await packageManager.isCLIInstalledAsync())) {
    try {
      // prompt user -- do you want to install cocoapods right now?
      step.text = 'CocoaPods CLI not found in your PATH, installing it now.';
      step.stopAndPersist();
      await PackageManager.CocoaPodsPackageManager.installCLIAsync({
        nonInteractive: true,
        spawnOptions: {
          ...packageManager.options,
          // Don't silence this part
          stdio: ['inherit', 'inherit', 'pipe'],
        },
      });
      step.succeed('Installed CocoaPods CLI.');
      step = logNewSection('Running `pod install` in the `ios` directory.');
    } catch (e) {
      step.stopAndPersist({
        symbol: '⚠️ ',
        text: chalk.red('Unable to install the CocoaPods CLI.'),
      });
      if (e instanceof PackageManager.CocoaPodsError) {
        Log.log(e.message);
      } else {
        Log.log(`Unknown error: ${e.message}`);
      }
      return false;
    }
  }

  try {
    await packageManager.installAsync({ spinner: step });
    // Create cached list for later
    await hasPackageJsonDependencyListChangedAsync(projectRoot).catch(() => null);
    step.succeed('Installed pods and initialized Xcode workspace.');
    return true;
  } catch (e) {
    step.stopAndPersist({
      symbol: '⚠️ ',
      text: chalk.red('Something went wrong running `pod install` in the `ios` directory.'),
    });
    if (e instanceof PackageManager.CocoaPodsError) {
      Log.log(e.message);
    } else {
      Log.log(`Unknown error: ${e.message}`);
    }
    return false;
  }
}

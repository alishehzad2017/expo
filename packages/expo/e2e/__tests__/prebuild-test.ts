/* eslint-env jest */
import execa from 'execa';
import fs from 'fs/promises';
import path from 'path';

import { execute, projectRoot, getRoot } from './utils';

const originalForceColor = process.env.FORCE_COLOR;
const originalCI = process.env.CI;
beforeAll(async () => {
  await fs.mkdir(projectRoot, { recursive: true });
  process.env.FORCE_COLOR = '1';
  process.env.CI = '1';
});
afterAll(() => {
  process.env.FORCE_COLOR = originalForceColor;
  process.env.CI = originalCI;
});

it('runs `npx expo prebuild --help`', async () => {
  const results = await execute('prebuild', '--help');
  expect(results.stdout).toMatchInlineSnapshot(`
    "
          [1mDescription[22m
            Create native iOS and Android project files before building natively.

          [1mUsage[22m
            $ npx expo prebuild <dir>

          <dir> is the directory of the Expo project.
          Defaults to the current working directory.

          Options
          --no-install                             Skip installing npm packages and CocoaPods.
          --clean                                  Delete the native folders and regenerate them before applying changes
          --npm                                    Use npm to install dependencies. (default when Yarn is not installed)
          --template <template>                    Project template to clone from. File path pointing to a local tar file or a github repo
          -p, --platform <all|android|ios>         Platforms to sync: ios, android, all. Default: all
          --skip-dependency-update <dependencies>  Preserves versions of listed packages in package.json (comma separated list)
          -h, --help                               Output usage information

        "
  `);
});

it('runs `npx expo prebuild` asserts when expo is not installed', async () => {
  const projectName = 'basic-prebuild-assert-no-expo';
  const projectRoot = getRoot(projectName);
  // Create the project root aot
  await fs.mkdir(projectRoot, { recursive: true });
  // Create a fake package.json -- this is a terminal file that cannot be overwritten.
  await fs.writeFile(path.join(projectRoot, 'package.json'), '{ "version": "1.0.0" }');
  await fs.writeFile(path.join(projectRoot, 'app.json'), '{ "expo": { "name": "foobar" } }');

  await expect(execute('prebuild', projectName, '--no-install')).rejects.toThrowError(
    /Cannot determine which native SDK version your project uses because the module `expo` is not installed\. Please install it with `yarn add expo` and try again./
  );
});

it(
  'runs `npx expo prebuild`',
  async () => {
    const projectName = 'basic-prebuild';
    const projectRoot = getRoot(projectName);
    // Create the project root aot
    await fs.mkdir(projectRoot, { recursive: true });
    // Create a fake package.json -- this is a terminal file that cannot be overwritten.
    await fs.writeFile(path.join(projectRoot, 'package.json'), '{ "version": "1.0.0" }');
    await fs.writeFile(
      path.join(projectRoot, 'app.json'),
      JSON.stringify({
        expo: {
          name: 'foobar',
          android: { package: 'com.bacon.foobar' },
          ios: { bundleIdentifier: 'com.bacon.foobar' },
          sdkVersion: '44.0.0',
        },
      })
    );

    console.log('Run in: ' + projectRoot);

    await execa('yarn', [], { cwd: projectRoot });

    console.log('Ready...');

    const results = await execute('prebuild', projectName, '--no-install');

    console.log(results);
  },
  30 * 1000
);

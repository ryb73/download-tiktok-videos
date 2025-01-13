/* eslint-disable no-console */
import { spawn } from "child_process";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { fd } from "@ryb73/super-duper-parakeet/lib/src/io/forceDecode.js";
import { array, record, recursion, string, union } from "io-ts";
import type { Type } from "io-ts";

// Check for CLI argument
if (process.argv.length !== 3) {
  console.error(`Usage: node download-videos.js <path-to-json-file>`);
  process.exit(1);
}

const jsonPath = process.argv[2]!;
const jsonData = JSON.parse(readFileSync(jsonPath, `utf-8`));

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
interface Input {
  [key: string]: Input | string[];
}

const Input: Type<Input> = recursion(`Input`, () =>
  record(string, union([Input, array(string)]))
);

const parsedJson = fd(Input, jsonData);

function rootKeyToPriority(key: string) {
  switch (key) {
    case `favorites`:
      return 0;
    case `chats`:
      return 1;
    case `shares`:
      return 2;
    case `likes`:
      return 3;
    default:
      return 4;
  }
}

type Result = {
  path: string;
  videoUrl: string;
  success: boolean;
  error?: string;
  catastrophic?: boolean;
};

const results: Result[] = [];

function runYtDlp(videoUrl: string, outputPath: string) {
  return new Promise<{ success: boolean; sigint: boolean }>((resolve) => {
    const childProcess = spawn(
      `yt-dlp`,
      [videoUrl, `-P`, outputPath, `-o`, `%(title).200s.%(ext)s`],
      { stdio: `inherit` }
    );

    childProcess.on(`exit`, (code, signal) => {
      if (signal === `SIGINT`) {
        resolve({ success: false, sigint: true });
      } else if (code !== 0) {
        resolve({ success: false, sigint: false });
      } else {
        resolve({ success: true, sigint: false });
      }
    });

    // You can also listen for the specific SIGINT signal
    childProcess.on(`SIGINT`, () => {
      console.log(`Received SIGINT signal`);
    });
  });
}

async function download(videoUrl: string, outputPath: string): Promise<Result> {
  try {
    // Create directory if it doesn't exist
    mkdirSync(outputPath, { recursive: true });

    const { success, sigint } = await runYtDlp(videoUrl, outputPath);

    return {
      path: outputPath,
      videoUrl,
      success,
      catastrophic: sigint,
    };
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    console.error(`Failed to download ${videoUrl}: ${error}`);
    return {
      catastrophic:
        String(error).includes(`KeyboardInterrupt`) ||
        String(error).includes(`Interrupted by user`),
      error: String(error),
      path: outputPath,
      success: false,
      videoUrl,
    };
  }
}

function getOutputFilename() {
  let outputPath = path.join(path.dirname(jsonPath), `downloaded-videos.json`);
  // if the path already exists, append a number to the end
  let i = 1;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, no-constant-condition
  while (true) {
    try {
      readFileSync(outputPath);
      outputPath = path.join(
        path.dirname(jsonPath),
        `downloaded-videos-${i}.json`
      );
      i++;
    } catch {
      break;
    }
  }

  return outputPath;
}

let isCleanupDone = false;

function cleanup() {
  if (isCleanupDone) return;
  isCleanupDone = true;

  const outputPath = getOutputFilename();
  console.log(`Writing results to ${outputPath}`);
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
}

async function traverse(
  input: Input,
  numVideos: number,
  startIndex: number,
  currentPath: string
) {
  let currentIndex = startIndex;

  const paths = Object.entries(input);

  for (const [key, value] of paths) {
    const keyPath = path.join(currentPath, key);

    if (Array.isArray(value)) {
      for (const link of value) {
        console.log(
          `\nDownloading ${link} to ${keyPath} [${currentIndex + 1}/${numVideos}]`
        );
        ++currentIndex;

        // eslint-disable-next-line no-await-in-loop
        const result = await download(link, keyPath);

        results.push(result);
        if (result.catastrophic === true) {
          cleanup();
          process.exit(1);
        }
      }
    } else {
      // eslint-disable-next-line no-await-in-loop
      currentIndex = await traverse(value, numVideos, currentIndex, keyPath);
    }
  }

  return currentIndex;
}

process.on(`SIGINT`, () => {
  console.log(`\nCaught interrupt signal`);
  cleanup();
  process.exit();
});

function countVideos(input: Input) {
  let count = 0;

  for (const value of Object.values(input)) {
    count += Array.isArray(value) ? value.length : countVideos(value);
  }

  return count;
}

try {
  const numVideos = countVideos(parsedJson);

  const parsedJsonEntries = Object.entries(parsedJson);
  parsedJsonEntries.sort(
    ([a], [b]) => rootKeyToPriority(a) - rootKeyToPriority(b)
  );
  const sortedParsedJson = Object.fromEntries(parsedJsonEntries);

  await traverse(sortedParsedJson, numVideos, 0, path.dirname(jsonPath));
} finally {
  cleanup();
}

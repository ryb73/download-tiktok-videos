import { fd } from "@ryb73/super-duper-parakeet/lib/src/io/forceDecode.js";
import { defined } from "@ryb73/super-duper-parakeet/lib/src/type-checks.js";
import { array, record, strict, string } from "io-ts";
import type { TypeOf } from "io-ts";
import blah from "../user-data/ryan.json";

const InputSchema = strict({
  Activity: strict({
    "Favorite Videos": strict({
      FavoriteVideoList: array(
        strict({
          Link: string,
        })
      ),
    }),
    "Like List": strict({
      ItemFavoriteList: array(
        strict({
          link: string,
        })
      ),
    }),
    "Share History": strict({
      ShareHistoryList: array(
        strict({
          Link: string,
        })
      ),
    }),
  }),
  "Direct Messages": strict({
    "Chat History": strict({
      ChatHistory: record(
        string,
        array(
          strict({
            Content: string,
          })
        )
      ),
    }),
  }),
});
type InputSchema = TypeOf<typeof InputSchema>;

// function recursivelyFindStringsContaining(
//   json: Json,
//   regex: RegExp
// ): { path: string; value: string }[] {
//   const results: { path: string; value: string }[] = [];

//   function recurse(recursingJson: Json, path: string) {
//     if (recursingJson == null) return;

//     if (typeof recursingJson === `string`) {
//       if (regex.test(recursingJson)) {
//         results.push({ path, value: recursingJson });
//       }
//     } else if (Array.isArray(recursingJson)) {
//       recursingJson.forEach((item, index) => {
//         recurse(item as Json, `${path}[${index}]`);
//       });
//     } else if (typeof recursingJson === `object`) {
//       Object.entries(recursingJson).forEach(([key, value]) => {
//         recurse(value, `${path}.${key}`);
//       });
//     }
//   }

//   recurse(json, ``);

//   return results;
// }

// console.log(
//   recursivelyFindStringsContaining(
//     blah,
//     /https:\/\/w{3}\.tiktokv\.com\//u
//   ).filter(
//     ({ path }) =>
//       !path.startsWith(`.Activity.Favorite Videos.FavoriteVideoList`) &&
//       !path.startsWith(`.Activity.Like List.ItemFavoriteList`) &&
//       !path.startsWith(`.Activity.Share History.ShareHistoryList`) &&
//       !path.startsWith(`.Activity.Video Browsing History`) &&
//       !path.startsWith(`.Direct Messages.Chat History.ChatHistory`)
//   )
// );

const parsedJson = fd(InputSchema, blah);

type Output = {
  favorites: string[];
  likes: string[];
  shares: string[];
  chats: Record<string, string[]>;
};

const urlRegex = /https:\/\/w{3}\.tiktokv\.com\//u;
function transformToOutput(input: InputSchema): Output {
  const favorites = input.Activity[`Favorite Videos`].FavoriteVideoList.map(
    (video) => video.Link
  );
  const likes = input.Activity[`Like List`].ItemFavoriteList.map(
    (video) => video.link
  );
  const shares = input.Activity[`Share History`].ShareHistoryList.map(
    (video) => video.Link
  );

  const chats = Object.entries(
    input[`Direct Messages`][`Chat History`].ChatHistory
  )
    .map(([key, value]) => {
      // Convert "Chat History with {username}:" to "{username}" in key
      const chatRegex = /Chat History with (?<username>.+):/u;
      const match = chatRegex.exec(key);
      if (match == null) {
        throw new Error(`Could not match chat key: ${key}`);
      }
      // eslint-disable-next-line @typescript-eslint/quotes
      const username = defined(match.groups?.["username"]);

      return {
        [username]: value
          .map((chat) => chat.Content)
          .filter((content) => urlRegex.test(content)),
      };
    })
    .reduce((acc, curr) => ({ ...acc, ...curr }), {});

  return {
    favorites,
    likes,
    shares,
    chats,
  };
}

const output = transformToOutput(parsedJson);
console.log(JSON.stringify(output, null, 2));

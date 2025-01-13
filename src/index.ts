import { array, strict, string } from "io-ts";

const schema = strict({
  Activity: strict({
    "Favorite Videos": strict({
      FavoriteVideoList: array(
        strict({
          Link: string,
        })
      ),
    }),
  }),
});

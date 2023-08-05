import dotenv from 'dotenv';
import fetch from 'node-fetch';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { access } from 'node:fs';
import { get } from 'node:http';
import { readFile } from 'fs/promises';

const rl = readline.createInterface({ input, output });

dotenv.config();

async function getSpotAccessToken() {
  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'post',
    headers: {
      Authorization:
        'Basic ' +
        new Buffer.from(
          process.env.SPOTIFY_CLIENT_ID +
            ':' +
            process.env.SPOTIFY_CLIENT_SECRET
        ).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
    json: true,
  });
  const data = await response.json();
  process.env.SPOTIFY_ACCESS_TOKEN = data.access_token;
}

async function getTracksSpot(playlistLink) {
  if (!process.env.SPOTIFY_ACCESS_TOKEN) {
    await getSpotAccessToken();
  }
  let playlistId;
  if (playlistLink.includes('https://open.spotify.com/playlist/')) {
    playlistId = playlistLink.replace('https://open.spotify.com/playlist/', '');
  } else {
    console.log('Invalid Spotify Playlist Link');
    process.exit(1);
  }

  const access_token = process.env.SPOTIFY_ACCESS_TOKEN;

  const response = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}`,
    {
      method: 'get',
      headers: {
        Authorization: 'Bearer ' + access_token,
      },
      json: true,
    }
  );
  const data = await response.json();
  const playlistName = await data.name;

  var url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`;
  var trackNames = [];
  while (url != null) {
    const response = await fetch(url, {
      method: 'get',
      headers: {
        Authorization: 'Bearer ' + access_token,
      },
      json: true,
    });
    const data = await response.json();
    // console.log(data);
    var tracks = await data.items;

    for (var i = 0; i < tracks.length; i++) {
      trackNames.push(
        tracks[i].track.name + ' - ' + tracks[i].track.artists[0].name
      );
    }
    url = data.next;
  }

  //   console.log(trackNames);
  for (var i = 0; i < trackNames.length; i++) {
    console.log(trackNames[i]);
  }

  return { playlistName: playlistName, trackNames: trackNames };
}

async function getYoutubeAccessToken() {
  console.log(
    `Please use this to login to your account:\n https://accounts.google.com/o/oauth2/v2/auth?scope=https%3A//www.googleapis.com/auth/youtube&include_granted_scopes=true&response_type=token&redirect_uri=http%3A//localhost:5000&client_id=${process.env.YT_CLIENT_ID}`
  );
  const accessToken = await rl.question('\nEnter your access token:');
  process.env.YOUTUBE_ACCESS_TOKEN = accessToken;
  rl.close();
  return accessToken;
}

async function createYoutubePlaylist(playlistName) {
  let access_token;
  if (!process.env.YOUTUBE_ACCESS_TOKEN) {
    access_token = await getYoutubeAccessToken();
  } else {
    access_token = process.env.YOUTUBE_ACCESS_TOKEN;
  }
  const response = await fetch(
    'https://www.googleapis.com/youtube/v3/playlists?part=snippet',
    {
      method: 'post',
      headers: {
        Authorization: 'Bearer ' + access_token,
      },
      body: JSON.stringify({ snippet: { title: playlistName } }),
      json: true,
    }
  );
  const data = await response.json();
  console.log(data);
  return data.id;
}

async function findingYoutubeVideo(trackName) {
  const response = await fetch(
    `https://youtube.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&type=video&key=${process.env.YT_API_KEY}&q=${trackName}`,
    {
      method: 'get',
      headers: {
        Accept: 'application/json',
      },
    }
  );
  const data = await response.json();

  console.log(data);
  const id = data.items[0].id.videoId;
  console.log(`https://www.youtube.com/watch?v=${id}`);
  console.log(data.items[0].snippet.title);
  console.log(data.items[0].id);
  return data.items[0].id;
}

async function addVideoToPlaylist(playlistId, resourceId) {
  let access_token;
  if (!process.env.YOUTUBE_ACCESS_TOKEN) {
    access_token = await getYoutubeAccessToken();
  } else {
    access_token = process.env.YOUTUBE_ACCESS_TOKEN;
  }
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&key=${process.env.YT_API_KEY}`,
    {
      method: 'post',
      headers: {
        Authorization: 'Bearer ' + access_token,
      },
      body: JSON.stringify({
        snippet: {
          playlistId: playlistId,
          resourceId: resourceId,
        },
      }),
    }
  );
  const data = await response.json();
  console.log(data);
}

async function createPlaylistAndAddTracks(playlistName, tracks) {
  const playlistId = await createYoutubePlaylist(playlistName);
  for (var i = 0; i < tracks.length; i++) {
    const trackName = tracks[i];
    const resourceId = await findingYoutubeVideo(trackName);
    await addVideoToPlaylist(playlistId, resourceId);
  }
}

async function addTrackstoPlaylist(playlistId, tracks) {
  for (var i = 0; i < tracks.length; i++) {
    const trackName = tracks[i];
    const resourceId = await findingYoutubeVideo(trackName);
    await addVideoToPlaylist(playlistId, resourceId);
  }
}

async function addResourcestoPlaylist(playlistId, resources) {
  for (var i = 0; i < resources.length; i++) {
    const resourceId = resources[i];
    await addVideoToPlaylist(playlistId, resourceId);
  }
}

async function createAndAddFromSpotifyLink(playlistLink, start, stop) {
  const { playlistName, trackNames } = await getTracksSpot(playlistLink);
  createPlaylistAndAddTracks(playlistName, trackNames.slice(0, limit));
}

// createAndAddFromSpotifyLink(
//   'https://open.spotify.com/playlist/0dae3xxCyZGPPFuKf7bxec',
//   20
// );

// getTracksSpot('https://open.spotify.com/playlist/0dae3xxCyZGPPFuKf7bxec');

const data = await readFile('tracks.txt');
// console.log(data.toString().split('\n'));

addTrackstoPlaylist(
  'PLJtpUjgBF-c0x0tIvgIB_t7ZuWW5B-zSy',
  data.toString().split('\n')
);

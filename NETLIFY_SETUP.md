# Netlify Deployment Setup

## Environment Variables Required

To deploy this app on Netlify, you need to set the following environment variables in your Netlify dashboard:

### 1. Go to Netlify Dashboard
1. Log into your Netlify account
2. Select your site
3. Go to **Site settings** → **Environment variables**

### 2. Add These Variables

```
TMDB_API_KEY=your_tmdb_api_key_here
TMDB_ACCESS_TOKEN=your_tmdb_access_token_here
```

### 3. Get Your TMDB Credentials

1. Go to [TMDB API](https://www.themoviedb.org/settings/api)
2. Create an account or log in
3. Request an API key
4. Copy both:
   - **API Key (v3 auth)**
   - **Access Token (v4 auth)**

### 4. Set Variables in Netlify

1. Click **Add variable**
2. Set **Key**: `TMDB_API_KEY`
3. Set **Value**: Your API key from TMDB
4. Click **Save**
5. Repeat for `TMDB_ACCESS_TOKEN`

### 5. Redeploy

After setting the environment variables:
1. Go to **Deploys** tab
2. Click **Trigger deploy** → **Deploy site**

## Build Settings

Make sure your build settings are:
- **Build command**: `npm run build`
- **Publish directory**: `.next`
- **Node version**: 18.x or higher

## Troubleshooting

If you still get errors:
1. Check the **Functions** tab for any error logs
2. Verify environment variables are set correctly
3. Make sure there are no typos in variable names
4. Check that your TMDB API key is valid and active

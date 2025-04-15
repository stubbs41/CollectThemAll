# Deployment Setup Instructions

To enable automatic deployments to Vercel and Netlify when you push to GitHub, you need to set up a few secrets in your GitHub repository.

## GitHub Actions Secrets Setup

1. Go to your GitHub repository: https://github.com/stubbs41/CollectThemAll
2. Navigate to "Settings" > "Secrets and variables" > "Actions"
3. Add the following secrets:

### Vercel Secrets

1. `VERCEL_TOKEN`:
   - Go to https://vercel.com/account/tokens
   - Create a new token with a descriptive name like "GitHub Actions"
   - Copy the token and add it as a secret in GitHub

2. `VERCEL_ORG_ID`:
   - Run `vercel teams ls` or `vercel project ls` to find your team/org ID
   - For your personal account, use your Vercel username or ID from `vercel whoami`
   - The Org ID is: `team_jgIUTssNJ0eaXe9xLvY5M9cr`

3. `VERCEL_PROJECT_ID`:
   - Run `vercel projects ls` to see your project ID
   - Or go to Vercel dashboard and get it from project settings
   - For your Pokémon TCG app, it is: `prj_E8kU3aluoguu3DbXqnOspakJXiku`

### Netlify Secrets

1. `NETLIFY_AUTH_TOKEN`:
   - Go to https://app.netlify.com/user/applications
   - Create a new personal access token
   - Copy the token and add it as a secret in GitHub

2. `NETLIFY_SITE_ID`:
   - Go to your Netlify site settings
   - The Site ID is listed under "Site information" or in the API ID field
   - Or run `netlify sites:list` if you have the Netlify CLI installed

## Using the Deployment Script

Once you have set up the secrets, you can use the `deploy.sh` script to easily commit and deploy your changes:

```bash
./deploy.sh "Your commit message here"
```

This will:
1. Add all your changes
2. Commit them with your message
3. Push to GitHub, which triggers the GitHub Actions workflow
4. The workflow will then deploy to both Vercel and Netlify automatically

## Deployment URLs

- Vercel: https://poke-binder-ryans-projects-ee570422.vercel.app
#!/bin/bash

# Check if a commit message was provided
if [ -z "$1" ]; then
    echo "Please provide a commit message"
    echo "Usage: ./deploy.sh \"Your commit message\""
    exit 1
fi

# Add all changes
echo "Adding all changes..."
git add .

# Commit changes with the provided message
echo "Committing changes with message: $1"
git commit -m "$1"

# Push to GitHub, which will trigger the GitHub workflow
echo "Pushing to GitHub..."
git push origin main

echo "Changes pushed to GitHub."
echo "GitHub Actions will now deploy to Vercel and Netlify automatically."
echo "You can check the status at: https://github.com/stubbs41/MyBinder/actions" 
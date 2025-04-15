# CollectThemAll - Pokémon TCG Collection Tracker

## About The Project

CollectThemAll is a web application designed for Pokémon TCG collectors. It allows users to easily track the cards they **have** in their collection and the cards they **want**, explore card details, manage quantities, and share their lists with others.

Built with modern web technologies, it aims to provide a clean and efficient interface for managing Pokémon card collections.

## Core Features

*   **User Authentication:** Secure sign-up and login using Supabase Auth (email/password).
*   **Card Catalog Exploration:** Browse and search for Pokémon TCG cards (details fetched from an external API via the backend).
*   **Collection Management:**
    *   Maintain separate "Have" and "Want" lists.
    *   Track the quantity of each card owned in the "Have" list.
    *   Visual indicators on cards to show collection status (Have/Want).
*   **Quantity Adjustment:** Easily increase/decrease the quantity of owned cards directly from the collection view using +/- buttons.
*   **Card Details:** View detailed information for each card in a modal view.
*   **Collection Import/Export:**
    *   Export your "Have" or "Want" list to a JSON file.
    *   Import cards into your collection from a previously exported JSON file.
*   **Collection Sharing:**
    *   Generate unique, shareable links for your "Have" or "Want" lists.
    *   Set optional expiration times for shared links (1 hour, 1 day, 7 days, 30 days, or never).
*   **Share Management ("My Shares"):**
    *   Dedicated page to view a history of all created share links (Active, Expired, Revoked).
    *   Filter and search through created shares.
    *   Revoke active share links.
*   **Search & Sort:** Search collections by card name/ID and sort by various criteria (Name, Date Added, Quantity).

## Technology Stack

*   **Framework:** [Next.js](https://nextjs.org/) (App Router)
*   **Language:** [TypeScript](https://www.typescriptlang.org/)
*   **Backend & Database:** [Supabase](https://supabase.com/)
    *   Authentication
    *   Postgres Database
    *   (Potentially Edge Functions for API routes)
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/)
*   **Deployment:** [Vercel](https://vercel.com/)
*   **State Management:** React Context API
*   **Key Libraries:**
    *   `@supabase/auth-helpers-nextjs` (Supabase integration)
    *   `date-fns` (Date formatting)
    *   `uuid` (Generating unique IDs)

## How It Works

*   The application uses Next.js for both frontend rendering and API routes.
*   User authentication is handled by Supabase Auth, with session management via cookies facilitated by `@supabase/auth-helpers-nextjs`.
*   Card data for exploration is fetched via API routes (e.g., `/api/cards`) which likely proxy requests to an external Pokémon TCG API.
*   User collection data (`have`/`want` lists, quantities) is stored in a Supabase Postgres database (`collections` table) and accessed via API routes (e.g., `/api/collections`).
*   Collection state on the frontend is managed using React Context (`CollectionContext`), which interacts with the backend API service (`CollectionService`).
*   Sharing creates a snapshot of a collection list in the `shared_collections` table in Supabase, accessible via a unique ID (`/shared/[id]`) through the `/api/collections/share` route.
*   The `/my-shares` page fetches the user's share history from the `/api/collections/my-shares` route.

## Getting Started (Development)

### Prerequisites

*   Node.js (v18 or later recommended)
*   npm or yarn
*   A Supabase account (free tier is sufficient)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/stubbs41/CollectThemAll.git
    cd CollectThemAll
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    # or
    # yarn install
    ```
3.  **Set up Supabase:**
    *   Create a new project on [Supabase](https://app.supabase.com/).
    *   Go to your project's **Settings** > **API**.
    *   Find your **Project URL** and **anon public key**.
4.  **Configure Environment Variables:**
    *   Create a file named `.env.local` in the root of the project.
    *   Add your Supabase credentials:
        ```dotenv
        NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
        NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_PUBLIC_KEY
        ```
    *   *(Note: Ensure your Supabase database schema is set up. If migrations are included in `supabase/migrations`, you might need the Supabase CLI to apply them locally or configure the database manually.)*
5.  **Run the development server:**
    ```bash
    npm run dev
    # or
    # yarn dev
    ```
6.  Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment

This project is configured for deployment on [Vercel](https://vercel.com/). Pushes to the `main` branch should automatically trigger a deployment if the GitHub repository is linked in Vercel.

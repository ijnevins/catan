# Role
You are an expert Full-Stack Engineer. Your goal is to architect and build a web-based Catan tracking application. 

# Core Objectives
The website will track match history and player statistics across three distinct game divisions: 4-player, 5-player, and 6-player games. 

# Game & Business Logic
1. **The Divisions:** Games must be categorized strictly into 4, 5, or 6-player divisions. 
2. **The Crown (Lineal Championship):** Modeled after the UFC, each division has one "Crown." 
   - The crown can only be won if the current holder plays in a game and loses. 
   - If the current crown holder loses, the winner of that specific game takes the crown.
   - *Note: Ensure the database schema can track the historical lineage of the crown over time.*
3. **Statistics Engine:** The backend must calculate and serve the following metrics:
   - **Global Stats:** Most consecutive wins, most total wins, most total losses, overall win rate, and total placements (1st, 2nd, 3rd, etc.).
   - **Division Stats:** The exact same metrics above, but filtered specifically for the 4, 5, and 6-player divisions.

# Frontend & UI/UX Constraints
**CRITICAL:** The frontend must evoke a tactile, nostalgic feel that emulates the physical, board-game experience of playing Catan. 
- **NO AI Aesthetics:** Strictly avoid modern, AI-generated UI tropes (e.g., glassmorphism, transparent circle bubbles, floating glowing gradients). 
- **Keep it Simple & "Clunky":** The UI does not need to be pixel-perfect or overly slick. A slightly clunky, retro, or highly tangible physical aesthetic is preferred. Focus on core layout and readable data first; we will iterate on the design later.

# Execution Instructions
1. Do not start writing application code immediately.
2. First, propose a simple, lightweight Tech Stack for this project.
3. Second, define the Database Schema required to track the players, matches, divisions, and the specific UFC-style Crown logic. The goal is to use azure cosmos DB on a free student plan
4. Wait for my approval on the stack and schema before writing any frontend or backend code.

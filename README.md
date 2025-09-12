# What Should I Watch? 🎬

A modern web application that helps you discover your next favorite movie or TV show across multiple streaming platforms. No more endless scrolling through catalogs - just spin and watch!

## ✨ Features

- **🎰 Slot Machine Interface**: Fun, interactive way to discover content
- **📺 Multi-Platform Support**: Netflix, Disney+, Hulu, Prime Video, HBO Max, Apple TV+
- **🎭 Content Filtering**: Choose between movies and TV shows
- **⭐ Rich Content Details**: Ratings, runtime, genres, and streaming availability
- **🔄 Smart Recommendations**: Multiple fallback strategies to find the perfect content
- **📱 Responsive Design**: Works beautifully on desktop and mobile
- **⚡ Real-time Loading States**: Clear feedback during content discovery

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- TMDB API key (free at [themoviedb.org](https://www.themoviedb.org/settings/api))

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd wsiw
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_TMDB_API_KEY=your_api_key_here
   NEXT_PUBLIC_TMDB_ACCESS_TOKEN=your_access_token_here
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🛠️ Tech Stack

- **Framework**: Next.js 14
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **API**: The Movie Database (TMDB)
- **HTTP Client**: Axios

## 🏗️ Architecture

### Refactored Code Structure

The application has been refactored for better maintainability:

- **`fetchContentWithStrategies()`**: Handles content discovery with multiple fallback strategies
- **`findContentWithMatchingProviders()`**: Processes content to find streaming availability
- **`getContentDetails()`**: Fetches additional content metadata
- **`formatContentItem()`**: Formats content for display
- **Enhanced Error Handling**: Specific error types with detailed messages
- **Granular Loading States**: Better user feedback during different operations

### Key Improvements

- ✅ **Maintainability**: Broke down 400+ line function into focused, testable functions
- ✅ **Error Handling**: Comprehensive error types and user-friendly messages
- ✅ **User Experience**: Detailed loading states and progress feedback
- ✅ **Performance**: Cleaner separation of concerns and better resource management
- ✅ **Debugging**: Structured logging and error reporting

## 🎯 How It Works

1. **Select Preferences**: Choose your preferred streaming services and content types
2. **Spin the Wheel**: Click the spin button to discover content
3. **Smart Discovery**: The app uses multiple strategies to find content:
   - Provider-specific content search
   - Popular content discovery
   - Trending content fallback
   - Random content selection
4. **View Results**: Get detailed information about your recommendation

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## 📝 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_TMDB_API_KEY` | TMDB API key for content discovery | Yes |
| `NEXT_PUBLIC_TMDB_ACCESS_TOKEN` | TMDB access token for API requests | Yes |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [The Movie Database (TMDB)](https://www.themoviedb.org/) for the comprehensive movie and TV data
- [Next.js](https://nextjs.org/) for the amazing React framework
- [Tailwind CSS](https://tailwindcss.com/) for the utility-first CSS framework

## 📞 Support

If you encounter any issues or have questions, please open an issue on GitHub.

---

**Happy Watching! 🍿**

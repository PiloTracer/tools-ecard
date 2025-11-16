export default function Home() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-black overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-blue-900/20 to-teal-900/20" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(120,119,198,0.3),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(34,211,238,0.2),transparent_50%)]" />

      <main className="relative z-10 flex flex-col items-center justify-center px-6 py-32 text-center max-w-4xl mx-auto">
        {/* Logo/Icon area with gradient */}
        <div className="mb-8 relative">
          <div className="absolute inset-0 blur-3xl bg-gradient-to-r from-purple-500 via-blue-500 to-teal-500 opacity-30 rounded-full" />
          <div className="relative bg-gradient-to-br from-purple-600 via-blue-600 to-teal-600 p-6 rounded-2xl shadow-2xl">
            <svg
              className="w-16 h-16 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z M12 3v4"
              />
            </svg>
          </div>
        </div>

        {/* Main title with gradient */}
        <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-purple-400 via-blue-400 to-teal-400 bg-clip-text text-transparent leading-tight">
          E-Card + QR-Code
          <br />
          Batch Generator
        </h1>

        {/* Description */}
        <p className="text-xl md:text-2xl text-gray-300 mb-4 max-w-2xl leading-relaxed">
          Transform your workflow with professional batch card generation
        </p>
        <p className="text-lg text-gray-400 mb-12 max-w-2xl">
          Create stunning personalized cards with dynamic QR codes, customizable templates, and intelligent name parsing.
          From design to deployment in minutes.
        </p>

        {/* Features grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16 w-full max-w-3xl">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all">
            <div className="text-3xl mb-3">🎨</div>
            <h3 className="text-white font-semibold mb-2">Template Designer</h3>
            <p className="text-gray-400 text-sm">Visual editor with drag-and-drop elements</p>
          </div>
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all">
            <div className="text-3xl mb-3">📊</div>
            <h3 className="text-white font-semibold mb-2">Batch Import</h3>
            <p className="text-gray-400 text-sm">Excel & text parsing with AI assistance</p>
          </div>
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all">
            <div className="text-3xl mb-3">⚡</div>
            <h3 className="text-white font-semibold mb-2">Fast Rendering</h3>
            <p className="text-gray-400 text-sm">High-performance card generation engine</p>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
          <button className="group relative flex-1 h-14 px-8 rounded-xl overflow-hidden transition-all hover:scale-105">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-blue-600 to-teal-600" />
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-blue-500 to-teal-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="relative z-10 text-white font-semibold text-lg">Login with Tools Dashboard</span>
          </button>

          <button className="group relative flex-1 h-14 px-8 rounded-xl overflow-hidden bg-white/10 backdrop-blur-sm border-2 border-white/20 hover:border-white/40 transition-all hover:scale-105">
            <span className="relative z-10 text-white font-semibold text-lg">Subscribe</span>
          </button>
        </div>

        {/* Footer tagline */}
        <div className="mt-12 flex flex-col items-center gap-2">
          <p className="text-gray-500 text-sm">
            Powered by AI Epic Studio · Designed for scale and style
          </p>
          <p className="text-gray-600 text-xs">
            © {new Date().getFullYear()}{" "}
            <a
              href="https://AIEpicStudio.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 transition-colors underline"
            >
              AIEpicStudio.com
            </a>
            {" "}· All rights reserved
          </p>
        </div>
      </main>
    </div>
  );
}

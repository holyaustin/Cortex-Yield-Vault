export default function Footer() {
  return (
    <footer className="border-t border-border-light dark:border-border-dark py-8 mt-auto">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Built with 🧠 on Somnia Agentic L1
          </div>
          <div className="flex space-x-6">
            <a href="https://somnia.network" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 hover:text-primary transition-colors">
              Somnia Network
            </a>
            <a href="https://testnet-explorer.somnia.network" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 hover:text-primary transition-colors">
              Explorer
            </a>
            <a href="#" className="text-sm text-gray-500 hover:text-primary transition-colors">
              GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
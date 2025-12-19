/**
 * Component Loader
 * Načítá HTML komponenty do stránek
 */

async function loadComponent(elementId, componentPath) {
  try {
    const response = await fetch(componentPath);
    if (!response.ok) {
      throw new Error(`Failed to load component: ${componentPath}`);
    }
    const html = await response.text();
    const element = document.getElementById(elementId);
    if (element) {
      element.innerHTML = html;

      // Execute scripts in loaded component
      const scripts = element.querySelectorAll('script');
      scripts.forEach(script => {
        const newScript = document.createElement('script');
        newScript.textContent = script.textContent;
        document.body.appendChild(newScript);
      });
    }
  } catch (error) {
    console.error('Error loading component:', error);
  }
}

// Auto-load components on all pages
document.addEventListener('DOMContentLoaded', () => {
  loadComponent('sidebar-container', '/components/sidebar.html');
  loadComponent('ticker-container', '/components/ticker.html');
});

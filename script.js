// MarkdPDF - Markdown to PDF Converter
// Main Application Logic

class MarkdownConverter {
    constructor() {
        this.init();
        this.bindEvents();
        this.updatePreview();
    }

    init() {
        // Get DOM elements
        this.markdownInput = document.getElementById('markdown-input');
        this.markdownPreview = document.getElementById('markdown-preview');
        this.fileInput = document.getElementById('file-input');
        this.savePdfBtn = document.getElementById('save-pdf');
        this.refreshBtn = document.getElementById('refresh-preview');
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.formatBtns = document.querySelectorAll('.format-btn');

        // Configure marked.js for better markdown parsing
        marked.setOptions({
            highlight: function(code, lang) {
                return code; // Basic highlighting, can be enhanced with highlight.js
            },
            breaks: true,
            gfm: true, // GitHub Flavored Markdown
            tables: true,
            sanitize: false // We'll use DOMPurify for sanitization
        });

        // Add smooth animations
        this.addAnimations();
    }

    bindEvents() {
        // Real-time markdown preview
        this.markdownInput.addEventListener('input', () => {
            this.debounce(this.updatePreview.bind(this), 300)();
        });

        // File input handling
        this.fileInput.addEventListener('change', (e) => {
            this.handleFileLoad(e);
        });

        // Save PDF functionality
        this.savePdfBtn.addEventListener('click', () => {
            this.generatePDF();
        });

        // Refresh preview
        this.refreshBtn.addEventListener('click', () => {
            this.updatePreview();
            this.animateRefresh();
        });

        // Formatting buttons
        this.formatBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.handleFormatting(e.target.closest('.format-btn').dataset.format);
            });
        });

        // Keyboard shortcuts
        this.markdownInput.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });

        // Prevent default drag and drop, enable custom file drop
        this.setupDragAndDrop();

        // Auto-resize textarea
        this.markdownInput.addEventListener('input', () => {
            this.autoResizeTextarea();
        });

        // Window resize handler for responsive layout
        window.addEventListener('resize', () => {
            this.debounce(this.handleResize.bind(this), 250)();
        });
    }

    updatePreview() {
        const markdownText = this.markdownInput.value;
        
        if (!markdownText.trim()) {
            this.markdownPreview.innerHTML = '<p style="color: #999; text-align: center; margin: 2em 0;">Start typing markdown to see the preview...</p>';
            return;
        }

        try {
            // Parse markdown to HTML
            let html = marked.parse(markdownText);
            
            // Sanitize HTML to prevent XSS
            html = DOMPurify.sanitize(html);
            
            // Update preview with animation
            this.animatePreviewUpdate(() => {
                this.markdownPreview.innerHTML = html;
                // Handle image loading for external URLs
                this.handleImageLoading();
            });

        } catch (error) {
            console.error('Error parsing markdown:', error);
            this.markdownPreview.innerHTML = `
                <div style="color: #ff4444; padding: 1em; background: #ffe6e6; border-radius: 4px; border-left: 4px solid #ff4444;">
                    <strong>Error parsing markdown:</strong><br>
                    ${error.message}
                </div>
            `;
        }
    }

    handleFileLoad(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        const allowedTypes = ['text/markdown', 'text/plain', 'application/octet-stream'];
        const fileExtension = file.name.toLowerCase().split('.').pop();
        
        if (!allowedTypes.includes(file.type) && !['md', 'markdown', 'txt'].includes(fileExtension)) {
            this.showNotification('Please select a valid markdown file (.md, .markdown, .txt)', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this.markdownInput.value = e.target.result;
            this.updatePreview();
            this.animateFileLoad();
            this.showNotification(`File "${file.name}" loaded successfully!`, 'success');
        };

        reader.onerror = () => {
            this.showNotification('Error reading file', 'error');
        };

        reader.readAsText(file);
    }

    async generatePDF() {
        if (!this.markdownInput.value.trim()) {
            this.showNotification('Please enter some markdown content first', 'warning');
            return;
        }

        this.showLoading(true);

        try {
            // Prepare content for PDF
            const element = this.markdownPreview;
            
            // PDF generation options
            const options = {
                margin: [10, 10, 10, 10],
                filename: this.generateFilename(),
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: {
                    scale: 1.5,
                    useCORS: false,
                    allowTaint: false,
                    letterRendering: true,
                    logging: false,
                    width: this.markdownPreview.scrollWidth,
                    height: this.markdownPreview.scrollHeight,
                    ignoreElements: function(element) {
                        // Completely ignore all images to prevent canvas taint
                        return element.tagName === 'IMG';
                    },
                    onclone: function(clonedDoc) {
                        // Remove ALL images completely to prevent any taint issues
                        const images = clonedDoc.querySelectorAll('img');
                        images.forEach(img => {
                            const textDiv = clonedDoc.createElement('div');
                            textDiv.style.cssText = 'padding: 12px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; margin: 12px 0; font-size: 14px; color: #666; text-align: center; font-family: Arial, sans-serif;';
                            textDiv.innerHTML = '<em>[Image: ' + (img.alt || 'Image') + ']</em>';
                            img.parentNode.replaceChild(textDiv, img);
                        });
                        
                        // Replace image fallback divs
                        const fallbacks = clonedDoc.querySelectorAll('div[style*="border: 2px dashed"]');
                        fallbacks.forEach(fallback => {
                            const textDiv = clonedDoc.createElement('div');
                            textDiv.style.cssText = 'padding: 12px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; margin: 12px 0; font-size: 14px; color: #666; text-align: center; font-family: Arial, sans-serif;';
                            textDiv.innerHTML = '<em>[Image not available in PDF]</em>';
                            fallback.parentNode.replaceChild(textDiv, fallback);
                        });
                        
                        // Remove any remaining potentially problematic elements
                        const iframes = clonedDoc.querySelectorAll('iframe, embed, object');
                        iframes.forEach(el => el.remove());
                        
                        // Improve page break handling with CSS
                        const style = clonedDoc.createElement('style');
                        style.textContent = `
                            @media print {
                                h1, h2, h3, h4, h5, h6 {
                                    page-break-after: avoid;
                                    page-break-inside: avoid;
                                    break-after: avoid;
                                    break-inside: avoid;
                                }
                                p, li {
                                    page-break-inside: avoid;
                                    break-inside: avoid;
                                    orphans: 2;
                                    widows: 2;
                                }
                                pre, blockquote {
                                    page-break-inside: avoid;
                                    break-inside: avoid;
                                }
                                table {
                                    page-break-inside: auto;
                                }
                                tr {
                                    page-break-inside: avoid;
                                    break-inside: avoid;
                                }
                            }
                        `;
                        clonedDoc.head.appendChild(style);
                    }
                },
                jsPDF: {
                    unit: 'mm',
                    format: 'a4',
                    orientation: 'portrait',
                    compress: true
                },
                pagebreak: {
                    mode: ['avoid-all', 'css', 'legacy'],
                    avoid: 'h1,h2,h3,h4,h5,h6,p,li,pre,blockquote'
                }
            };

            // Generate PDF
            await html2pdf().set(options).from(element).save();
            
            this.showNotification('PDF generated successfully!', 'success');
            
        } catch (error) {
            console.error('Error generating PDF:', error);
            this.showNotification('Error generating PDF. Please try again.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    handleFormatting(format) {
        const textarea = this.markdownInput;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);
        let replacement = '';

        switch (format) {
            case 'bold':
                replacement = `**${selectedText || 'bold text'}**`;
                break;
            case 'italic':
                replacement = `*${selectedText || 'italic text'}*`;
                break;
            case 'underline':
                replacement = `<u>${selectedText || 'underlined text'}</u>`;
                break;
            case 'h1':
                replacement = `# ${selectedText || 'Heading 1'}`;
                break;
            case 'h2':
                replacement = `## ${selectedText || 'Heading 2'}`;
                break;
            case 'h3':
                replacement = `### ${selectedText || 'Heading 3'}`;
                break;
            case 'h4':
                replacement = `#### ${selectedText || 'Heading 4'}`;
                break;
            case 'h5':
                replacement = `##### ${selectedText || 'Heading 5'}`;
                break;
            case 'h6':
                replacement = `###### ${selectedText || 'Heading 6'}`;
                break;
            case 'quote':
                replacement = `> ${selectedText || 'Quote text'}`;
                break;
            case 'code':
                if (selectedText.includes('\n')) {
                    replacement = `\`\`\`\n${selectedText || 'code block'}\n\`\`\``;
                } else {
                    replacement = `\`${selectedText || 'code'}\``;
                }
                break;
            case 'link':
                replacement = `[${selectedText || 'link text'}](https://example.com)`;
                break;
            case 'image':
                replacement = `![${selectedText || 'alt text'}](image-url.jpg)`;
                break;
            case 'table':
                replacement = `| Header 1 | Header 2 | Header 3 |\n|----------|----------|----------|\n| Cell 1   | Cell 2   | Cell 3   |\n| Cell 4   | Cell 5   | Cell 6   |`;
                break;
            case 'list':
                replacement = `- ${selectedText || 'List item 1'}\n- List item 2\n- List item 3`;
                break;
        }

        // Insert the replacement text
        textarea.value = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
        
        // Update cursor position
        const newCursorPos = start + replacement.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        
        // Focus back to textarea
        textarea.focus();
        
        // Update preview
        this.updatePreview();
        
        // Add button animation
        this.animateButton(event.target.closest('.format-btn'));
    }

    handleKeyboardShortcuts(event) {
        if (!event.ctrlKey && !event.metaKey) return;

        const shortcuts = {
            'b': 'bold',
            'i': 'italic',
            'k': 'link'
        };

        const format = shortcuts[event.key.toLowerCase()];
        if (format) {
            event.preventDefault();
            this.handleFormatting(format);
        }

        // Save shortcut
        if (event.key === 's') {
            event.preventDefault();
            this.generatePDF();
        }
    }

    setupDragAndDrop() {
        const dropZone = this.markdownInput;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.add('drag-over');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.remove('drag-over');
            });
        });

        dropZone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.fileInput.files = files;
                this.handleFileLoad({ target: { files } });
            }
        });
    }

    // Utility functions
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    generateFilename() {
        const now = new Date();
        const timestamp = now.toISOString().split('T')[0];
        const title = this.extractTitleFromMarkdown() || 'markdown-document';
        return `${title}-${timestamp}.pdf`;
    }

    extractTitleFromMarkdown() {
        const content = this.markdownInput.value;
        const match = content.match(/^#\s+(.+)$/m);
        return match ? match[1].replace(/[^a-zA-Z0-9]/g, '-').toLowerCase() : null;
    }

    showLoading(show) {
        if (show) {
            this.loadingOverlay.classList.add('show');
        } else {
            this.loadingOverlay.classList.remove('show');
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
        `;

        // Style the notification
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${this.getNotificationColor(type)};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 1001;
            animation: slideInRight 0.3s ease-out;
            max-width: 400px;
        `;

        document.body.appendChild(notification);

        // Auto remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);

        // Add CSS for animations if not exists
        this.addNotificationStyles();
    }

    getNotificationIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || icons.info;
    }

    getNotificationColor(type) {
        const colors = {
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        };
        return colors[type] || colors.info;
    }

    addNotificationStyles() {
        if (document.getElementById('notification-styles')) return;

        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            @keyframes slideOutRight {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
            
            .notification-content {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .drag-over {
                border-color: var(--accent-primary) !important;
                box-shadow: 0 0 0 3px var(--accent-light) !important;
            }
        `;
        document.head.appendChild(style);
    }

    // Animation functions
    addAnimations() {
        // Add CSS animations
        const style = document.createElement('style');
        style.textContent = `
            .preview-updating {
                opacity: 0.7;
                transform: scale(0.98);
                transition: all 0.2s ease;
            }
            
            .button-clicked {
                transform: scale(0.95);
                transition: transform 0.1s ease;
            }
            
            .refresh-spin {
                animation: spin 0.5s ease-in-out;
            }
        `;
        document.head.appendChild(style);
    }

    animatePreviewUpdate(callback) {
        this.markdownPreview.classList.add('preview-updating');
        
        setTimeout(() => {
            callback();
            this.markdownPreview.classList.remove('preview-updating');
        }, 150);
    }

    animateButton(button) {
        button.classList.add('button-clicked');
        setTimeout(() => {
            button.classList.remove('button-clicked');
        }, 100);
    }

    animateRefresh() {
        this.refreshBtn.classList.add('refresh-spin');
        setTimeout(() => {
            this.refreshBtn.classList.remove('refresh-spin');
        }, 500);
    }

    animateFileLoad() {
        this.markdownInput.style.transform = 'scale(1.02)';
        this.markdownInput.style.transition = 'transform 0.2s ease';
        
        setTimeout(() => {
            this.markdownInput.style.transform = 'scale(1)';
            setTimeout(() => {
                this.markdownInput.style.transition = '';
            }, 200);
        }, 100);
    }

    autoResizeTextarea() {
        const textarea = this.markdownInput;
        textarea.style.height = 'auto';
        textarea.style.height = Math.max(400, textarea.scrollHeight) + 'px';
    }

    handleImageLoading() {
        const images = this.markdownPreview.querySelectorAll('img');
        images.forEach(img => {
            // Don't set CORS initially - let browser try normal loading first
            img.style.opacity = '0.7';
            img.style.transition = 'opacity 0.3s ease';
            
            // Create a promise-based loading approach
            const loadImage = (imgElement, useCORS = false) => {
                return new Promise((resolve, reject) => {
                    const testImg = new Image();
                    if (useCORS) {
                        testImg.crossOrigin = 'anonymous';
                    }
                    
                    testImg.onload = () => {
                        imgElement.style.opacity = '1';
                        if (useCORS) {
                            imgElement.crossOrigin = 'anonymous';
                        }
                        resolve();
                    };
                    
                    testImg.onerror = () => reject();
                    testImg.src = imgElement.src;
                });
            };
            
            // Try loading without CORS first, then with CORS if that fails
            loadImage(img, false)
                .catch(() => loadImage(img, true))
                .catch(() => {
                    // Only show fallback if both attempts fail
                    const fallback = document.createElement('div');
                    fallback.style.cssText = `
                        border: 2px dashed #ccc;
                        padding: 20px;
                        background: #f9f9f9;
                        color: #666;
                        text-align: center;
                        font-size: 14px;
                        font-family: Arial, sans-serif;
                        border-radius: 4px;
                        margin: 1em 0;
                    `;
                    fallback.innerHTML = `
                        <i class="fas fa-image" style="font-size: 24px; margin-bottom: 10px; display: block; color: #999;"></i>
                        <div>Image could not be loaded</div>
                        <div style="font-size: 12px; margin-top: 5px; word-break: break-all;">${img.src}</div>
                    `;
                    
                    img.parentNode.replaceChild(fallback, img);
                });
        });
    }

    handleResize() {
        // Handle any responsive layout adjustments
        this.autoResizeTextarea();
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MarkdownConverter();
    
    // Add some welcome animations
    setTimeout(() => {
        document.querySelector('.app-container').classList.add('fade-in');
    }, 100);
});

// Service worker removed to avoid 404 errors
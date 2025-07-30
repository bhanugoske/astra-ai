/**
 * ASTRA AI DASHBOARD - MODERN CHART MANAGER
 * Comprehensive chart management system with multiple chart types and modern features
 */

const ChartManager = {
    // Chart instances storage
    chartInstances: {},
    
    // Chart color schemes
    colorSchemes: {
        primary: {
            blue: '#3b82f6',
            purple: '#8b5cf6',
            green: '#10b981',
            orange: '#f59e0b',
            red: '#ef4444',
            teal: '#14b8a6',
            pink: '#ec4899',
            indigo: '#6366f1'
        },
        gradients: {
            blueGradient: ['#3b82f6', '#1d4ed8'],
            purpleGradient: ['#8b5cf6', '#7c3aed'],
            greenGradient: ['#10b981', '#059669'],
            orangeGradient: ['#f59e0b', '#d97706'],
            redGradient: ['#ef4444', '#dc2626']
        },
        backgrounds: {
            blue: 'rgba(59, 130, 246, 0.1)',
            purple: 'rgba(139, 92, 246, 0.1)',
            green: 'rgba(16, 185, 129, 0.1)',
            orange: 'rgba(245, 158, 11, 0.1)',
            red: 'rgba(239, 68, 68, 0.1)'
        }
    },

    // Default chart configuration
    getDefaultConfig() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: '#94a3b8',
                        font: {
                            family: 'Inter, sans-serif',
                            size: 12
                        },
                        padding: 20,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#f1f5f9',
                    bodyColor: '#cbd5e1',
                    borderColor: '#334155',
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 12,
                    displayColors: true,
                    titleFont: {
                        family: 'Inter, sans-serif',
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        family: 'Inter, sans-serif',
                        size: 12
                    },
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('en-US', {
                                    style: 'currency',
                                    currency: 'USD',
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0
                                }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            }
        };
    },

    // Line chart specific configuration
    getLineChartConfig() {
        const config = { ...this.getDefaultConfig() };
        config.scales = {
            y: {
                beginAtZero: false,
                ticks: {
                    color: '#64748b',
                    font: {
                        family: 'Inter, sans-serif',
                        size: 11
                    },
                    callback: function(value) {
                        return new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0
                        }).format(value);
                    }
                },
                grid: {
                    color: 'rgba(51, 65, 85, 0.3)',
                    drawBorder: false
                }
            },
            x: {
                ticks: {
                    color: '#64748b',
                    font: {
                        family: 'Inter, sans-serif',
                        size: 11
                    }
                },
                grid: {
                    display: false
                }
            }
        };
        return config;
    },

    // Doughnut chart specific configuration
    getDoughnutChartConfig() {
        const config = { ...this.getDefaultConfig() };
        config.cutout = '70%';
        config.plugins.legend.position = 'bottom';
        config.plugins.tooltip.callbacks = {
            label: function(context) {
                const label = context.label || '';
                const value = context.parsed;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return `${label}: ${value} (${percentage}%)`;
            }
        };
        return config;
    },

    // Bar chart specific configuration
    getBarChartConfig() {
        const config = { ...this.getDefaultConfig() };
        config.scales = {
            y: {
                beginAtZero: true,
                ticks: {
                    color: '#64748b',
                    font: {
                        family: 'Inter, sans-serif',
                        size: 11
                    }
                },
                grid: {
                    color: 'rgba(51, 65, 85, 0.3)',
                    drawBorder: false
                }
            },
            x: {
                ticks: {
                    color: '#64748b',
                    font: {
                        family: 'Inter, sans-serif',
                        size: 11
                    }
                },
                grid: {
                    display: false
                }
            }
        };
        return config;
    },

    // Initialize any chart
    initializeChart(canvasId, type, data, customOptions = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || !canvas.offsetParent) {
            console.warn(`Canvas element with ID "${canvasId}" not found or not visible`);
            return null;
        }

        const ctx = canvas.getContext('2d');
        
        // Destroy existing chart if it exists
        if (this.chartInstances[canvasId]) {
            this.chartInstances[canvasId].destroy();
        }

        // Get appropriate configuration based on chart type
        let config;
        switch(type) {
            case 'line':
                config = this.getLineChartConfig();
                break;
            case 'doughnut':
                config = this.getDoughnutChartConfig();
                break;
            case 'bar':
                config = this.getBarChartConfig();
                break;
            default:
                config = this.getDefaultConfig();
        }

        // Merge custom options
        const finalOptions = this.mergeDeep(config, customOptions);

        // Create and store the chart
        try {
            this.chartInstances[canvasId] = new Chart(ctx, {
                type,
                data,
                options: finalOptions
            });
            
            return this.chartInstances[canvasId];
        } catch (error) {
            console.error(`Error creating chart "${canvasId}":`, error);
            return null;
        }
    },

    // Create dashboard charts
    createDashboardCharts() {
        // Revenue line chart data
        const revenueData = {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
                label: 'Revenue',
                data: [45000, 52000, 48000, 61000, 55000, 67000],
                fill: true,
                backgroundColor: this.createGradient('lineChart', this.colorSchemes.backgrounds.blue),
                borderColor: this.colorSchemes.primary.blue,
                borderWidth: 3,
                tension: 0.4,
                pointBackgroundColor: this.colorSchemes.primary.blue,
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7
            }, {
                label: 'Profit',
                data: [12000, 19000, 15000, 25000, 22000, 30000],
                fill: true,
                backgroundColor: this.createGradient('lineChart', this.colorSchemes.backgrounds.green),
                borderColor: this.colorSchemes.primary.green,
                borderWidth: 3,
                tension: 0.4,
                pointBackgroundColor: this.colorSchemes.primary.green,
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        };

        // Growth models doughnut chart data
        const growthModelsData = {
            labels: ['SaaS', 'Enterprise', 'Consulting', 'Products'],
            datasets: [{
                label: 'Revenue Distribution',
                data: [45, 30, 15, 10],
                backgroundColor: [
                    this.colorSchemes.primary.blue,
                    this.colorSchemes.primary.purple,
                    this.colorSchemes.primary.green,
                    this.colorSchemes.primary.orange
                ],
                borderColor: '#1e293b',
                borderWidth: 3,
                hoverOffset: 8,
                hoverBorderWidth: 4
            }]
        };

        // Create charts
        this.initializeChart('lineChart', 'line', revenueData);
        this.initializeChart('growthModelsChart', 'doughnut', growthModelsData);
    },

    // Create company analysis charts
    createCompanyCharts(companyData) {
        if (!companyData) return;

        // Growth bar chart
        const growthData = {
            labels: companyData.data.map(item => item.metric),
            datasets: [{
                label: 'YoY Growth %',
                data: companyData.data.map(item => parseFloat(item.yoy_growth.replace('%', ''))),
                backgroundColor: companyData.data.map(item => {
                    const growth = parseFloat(item.yoy_growth.replace('%', ''));
                    return growth >= 0 ? this.colorSchemes.primary.green : this.colorSchemes.primary.red;
                }),
                borderColor: companyData.data.map(item => {
                    const growth = parseFloat(item.yoy_growth.replace('%', ''));
                    return growth >= 0 ? this.colorSchemes.primary.green : this.colorSchemes.primary.red;
                }),
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
            }]
        };

        // Revenue breakdown pie chart
        const revenueBreakdownData = {
            labels: companyData.revenue_breakdown.map(item => item.label),
            datasets: [{
                data: companyData.revenue_breakdown.map(item => item.value),
                backgroundColor: [
                    this.colorSchemes.primary.blue,
                    this.colorSchemes.primary.purple,
                    this.colorSchemes.primary.green,
                    this.colorSchemes.primary.orange,
                    this.colorSchemes.primary.teal
                ],
                borderColor: '#1e293b',
                borderWidth: 3,
                hoverOffset: 6
            }]
        };

        this.initializeChart('companyBarChart', 'bar', growthData);
        this.initializeChart('companyPieChart', 'pie', revenueBreakdownData);
    },

    // Create customer insights charts
    createCustomerCharts() {
        // Customer revenue trend
        const customerRevenueData = {
            labels: ['Q1', 'Q2', 'Q3', 'Q4'],
            datasets: [{
                label: 'Customer Revenue',
                data: [85000, 92000, 88000, 95000],
                fill: true,
                backgroundColor: this.createGradient('lineChart-customer', this.colorSchemes.backgrounds.purple),
                borderColor: this.colorSchemes.primary.purple,
                borderWidth: 3,
                tension: 0.4,
                pointBackgroundColor: this.colorSchemes.primary.purple,
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        };

        // Customer segmentation
        const customerSegmentData = {
            labels: ['Enterprise', 'SMB', 'Startup', 'Individual'],
            datasets: [{
                label: 'Customer Segments',
                data: [35, 40, 15, 10],
                backgroundColor: [
                    this.colorSchemes.primary.blue,
                    this.colorSchemes.primary.purple,
                    this.colorSchemes.primary.green,
                    this.colorSchemes.primary.orange
                ],
                borderColor: '#1e293b',
                borderWidth: 3,
                hoverOffset: 8
            }]
        };

        this.initializeChart('lineChart-customer', 'line', customerRevenueData);
        this.initializeChart('donutChart-customer', 'doughnut', customerSegmentData);
    },

    // Create prediction charts
    createPredictionCharts() {
        // Forecast data
        const forecastData = {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
            datasets: [{
                label: 'Actual',
                data: [45000, 52000, 48000, 61000, 55000, 67000, null, null, null],
                borderColor: this.colorSchemes.primary.blue,
                backgroundColor: this.colorSchemes.backgrounds.blue,
                borderWidth: 3,
                fill: true,
                tension: 0.4
            }, {
                label: 'Predicted',
                data: [null, null, null, null, null, 67000, 72000, 68000, 75000],
                borderColor: this.colorSchemes.primary.green,
                backgroundColor: this.colorSchemes.backgrounds.green,
                borderWidth: 3,
                borderDash: [5, 5],
                fill: true,
                tension: 0.4
            }]
        };

        this.initializeChart('predictionChart', 'line', forecastData);
    },

    // Utility: Create gradient
    createGradient(canvasId, color) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return color;
        
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, 'transparent');
        return gradient;
    },

    // Utility: Deep merge objects
    mergeDeep(target, source) {
        const output = Object.assign({}, target);
        if (this.isObject(target) && this.isObject(source)) {
            Object.keys(source).forEach(key => {
                if (this.isObject(source[key])) {
                    if (!(key in target))
                        Object.assign(output, { [key]: source[key] });
                    else
                        output[key] = this.mergeDeep(target[key], source[key]);
                } else {
                    Object.assign(output, { [key]: source[key] });
                }
            });
        }
        return output;
    },

    // Utility: Check if object
    isObject(item) {
        return item && typeof item === 'object' && !Array.isArray(item);
    },

    // Update chart data
    updateChart(canvasId, newData) {
        const chart = this.chartInstances[canvasId];
        if (!chart) {
            console.warn(`Chart with ID "${canvasId}" not found`);
            return;
        }

        chart.data = newData;
        chart.update('active');
    },

    // Destroy chart
    destroyChart(canvasId) {
        if (this.chartInstances[canvasId]) {
            this.chartInstances[canvasId].destroy();
            delete this.chartInstances[canvasId];
        }
    },

    // Destroy all charts
    destroyAllCharts() {
        Object.keys(this.chartInstances).forEach(canvasId => {
            this.destroyChart(canvasId);
        });
    },

    // Resize all charts
    resizeAllCharts() {
        Object.values(this.chartInstances).forEach(chart => {
            chart.resize();
        });
    },

    // Get chart instance
    getChart(canvasId) {
        return this.chartInstances[canvasId] || null;
    },

    // Export chart as image
    exportChart(canvasId, format = 'png') {
        const chart = this.chartInstances[canvasId];
        if (!chart) {
            console.warn(`Chart with ID "${canvasId}" not found`);
            return null;
        }

        return chart.toBase64Image(format);
    },

    // Initialize all dashboard charts
    initializeDashboard() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.createDashboardCharts();
            });
        } else {
            this.createDashboardCharts();
        }
    }
};

// Handle window resize
window.addEventListener('resize', () => {
    ChartManager.resizeAllCharts();
});

// Initialize charts when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    ChartManager.initializeDashboard();
});

// Make ChartManager globally available
window.ChartManager = ChartManager;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChartManager;
}

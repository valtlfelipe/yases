<template>
  <div class="relative h-56">
    <Bar
      :data="chartData"
      :options="chartOptions"
    />
  </div>
</template>

<script setup lang="ts">
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend)

const props = defineProps<{
  trend: Array<{ date: string, total: number, sent: number, failed: number }>
}>()

const chartData = computed(() => ({
  labels: props.trend.map(t => t.date.slice(5)),
  datasets: [
    {
      label: 'Sent',
      data: props.trend.map(t => t.sent),
      backgroundColor: 'rgba(34, 197, 94, 0.8)',
      borderRadius: 6,
      borderSkipped: false,
    },
    {
      label: 'Failed',
      data: props.trend.map(t => t.failed),
      backgroundColor: 'rgba(239, 68, 68, 0.8)',
      borderRadius: 6,
      borderSkipped: false,
    },
  ],
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: {
        usePointStyle: true,
        pointStyle: 'circle',
        padding: 20,
        font: { family: 'Outfit', size: 12 },
      },
    },
    tooltip: {
      backgroundColor: 'rgba(28, 25, 23, 0.95)',
      titleFont: { family: 'Outfit', size: 13 },
      bodyFont: { family: 'Outfit', size: 12 },
      padding: 12,
      cornerRadius: 8,
    },
  },
  scales: {
    x: {
      stacked: false,
      grid: { display: false },
      border: { display: false },
      ticks: { font: { family: 'Outfit', size: 11 }, color: '#78716c' },
    },
    y: {
      beginAtZero: true,
      border: { display: false },
      ticks: { precision: 0, font: { family: 'Outfit', size: 11 }, color: '#78716c' },
      grid: { display: false },
    },
  },
}
</script>

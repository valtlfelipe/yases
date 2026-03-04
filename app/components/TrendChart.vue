<template>
  <div class="relative h-72">
    <Line
      :data="chartData"
      :options="chartOptions"
    />
  </div>
</template>

<script setup lang="ts">
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler)

const props = defineProps<{
  trend: Array<{ date: string, total: number, sent: number, delivered: number, bounced: number, opened: number, failed: number }>
}>()

const labels = computed(() =>
  props.trend.map((t) => {
    const [, month, day] = t.date.split('-')
    return `${month}/${day}`
  }),
)

function line(data: number[], color: string, fill = false) {
  return {
    data,
    borderColor: color,
    backgroundColor: fill ? color.replace(')', ', 0.08)').replace('rgb', 'rgba') : 'transparent',
    borderWidth: 2,
    pointRadius: 3,
    pointHoverRadius: 5,
    pointBackgroundColor: color,
    tension: 0.35,
    fill,
  }
}

const chartData = computed(() => ({
  labels: labels.value,
  datasets: [
    { label: 'Sent', ...line(props.trend.map(t => t.sent), 'rgb(99, 102, 241)', true) },
    { label: 'Delivered', ...line(props.trend.map(t => t.delivered), 'rgb(34, 197, 94)') },
    { label: 'Opened', ...line(props.trend.map(t => t.opened), 'rgb(139, 92, 246)') },
    { label: 'Bounced', ...line(props.trend.map(t => t.bounced), 'rgb(251, 146, 60)') },
    { label: 'Failed', ...line(props.trend.map(t => t.failed), 'rgb(239, 68, 68)') },
  ],
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index' as const,
    intersect: false,
  },
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
      titleFont: { family: 'Outfit', size: 13, weight: 'bold' as const },
      bodyFont: { family: 'Outfit', size: 12 },
      padding: 12,
      cornerRadius: 8,
      itemSort: (a: { parsed: { y: number } }, b: { parsed: { y: number } }) => b.parsed.y - a.parsed.y,
    },
  },
  scales: {
    x: {
      grid: { display: false },
      border: { display: false },
      ticks: { font: { family: 'Outfit', size: 11 }, color: '#78716c' },
    },
    y: {
      beginAtZero: true,
      border: { display: false },
      ticks: { precision: 0, font: { family: 'Outfit', size: 11 }, color: '#78716c' },
      grid: { color: 'rgba(120, 113, 108, 0.08)' },
    },
  },
}
</script>

// src/app/services/apify-chart.service.ts
import { Injectable } from '@angular/core';
import type { EChartsOption } from 'echarts';

export type ChartMetric = 'total' | 'views' | 'likes' | 'comments';

interface BrandConfig {
  id: string;
  name: string;
  keywords: string[];
  color: string; // Color corporativo fijo para cada marca
  logoUrl?: string; // Logo de la marca
}

@Injectable({
  providedIn: 'root'
})
export class ApifyChartService {

  // Paleta de respaldo para marcas no registradas o embajadores
  private readonly fallbackPalette = [
    '#0ea5e9', '#8b5cf6', '#f43f5e', '#10b981', '#f59e0b', '#6366f1'
  ];

  // ==========================================
  // NORMALIZADOR ESCALABLE CON IDENTIDAD VISUAL Y LOGOS
  // ==========================================
  private readonly BRAND_DICTIONARY: BrandConfig[] = [
    {
      id: 'royal',
      name: 'Royal Canin',
      keywords: ['royal canin', 'royalcanin', 'royal_canin', 'royalcanincol', 'royal_canin_colombia', 'royal canin col'],
      color: '#E11D48',
      logoUrl: '/assets/logos/royal-canin.svg'
    },
    {
      id: 'hills',
      name: "Hill's Pet Nutrition",
      keywords: ['hill', 'science diet', 'hillspet', 'hillslatam'],
      color: '#1E3A8A',
      logoUrl: '/assets/logos/hills.svg'
    },
    {
      id: 'purina',
      name: 'Purina Pro Plan',
      keywords: ['pro plan', 'proplan', 'purina', 'proplanco', 'pro plan colombia', 'entre expertos purina', 'ponte la camiseta purina'],
      color: '#111827',
      logoUrl: '/assets/logos/purina-pro-plan.svg'
    },
    {
      id: 'agility',
      name: 'Agility Gold',
      keywords: ['agility', 'agilty', 'agiltygold', 'agility.gold', 'agility gold'],
      color: '#D97706',
      logoUrl: '/assets/logos/agility-gold.svg'
    },
    {
      id: 'bonnat',
      name: 'Bonnat',
      keywords: ['bonnat', 'bonnatpets', 'bonnatpetscol'],
      color: '#0D9488',
      logoUrl: '/assets/logos/bonnat.svg'
    },
    {
      id: 'virbac',
      name: 'Virbac',
      keywords: ['virbac', 'virbaccolombia'],
      color: '#2563EB',
      logoUrl: '/assets/logos/virbac.svg'
    },
    {
      id: 'chunky',
      name: 'Chunky Mascotas',
      keywords: ['chunky'],
      color: '#009CA6',
      logoUrl: '/assets/logos/chunky.svg'
    },
    {
      id: 'true_blue',
      name: 'True Blue',
      keywords: ['true blue', 'trueblue', 'b2vets by trueblue'],
      color: '#3B82F6',
      logoUrl: '/assets/logos/true-blue.svg'
    },
    {
      id: 'nupec',
      name: 'Nupec',
      keywords: ['nupec'],
      color: '#0284C7',
      logoUrl: '/assets/logos/nupec.svg'
    },
    {
      id: 'pets_table',
      name: "Pet's Table",
      keywords: ["pet's table", 'pets table'],
      color: '#059669',
      logoUrl: '/assets/logos/default-brand.svg'
    },
    {
      id: 'brit',
      name: 'Brit',
      keywords: ['brit'],
      color: '#DB2777',
      logoUrl: '/assets/logos/default-brand.svg'
    },
    {
      id: 'bravery',
      name: 'Bravery',
      keywords: ['bravery'],
      color: '#9333EA',
      logoUrl: '/assets/logos/default-brand.svg'
    },
    {
      id: 'b2b_media',
      name: 'Medios y Eventos B2B',
      keywords: ['pet industry', 'smartdogs', 'congreso', 'cvdc', 'balance dogs', 'orbit', 'familia_smartdogs'],
      color: '#475569',
      logoUrl: '/assets/logos/default-brand.svg'
    }
  ];

  public getNormalizedBrandName(item: any): string {
    const rawName = item.ownerFullName || item.ownerUsername || item.channelName || item.pageName || item.authorMeta?.name || item.authorMeta?.nickName || item.user?.name || item.title || 'Desconocido';
    const nameLower = rawName.toLowerCase();

    const matchedBrand = this.BRAND_DICTIONARY.find(brand =>
      brand.keywords.some(keyword => nameLower.includes(keyword))
    );

    if (matchedBrand) return matchedBrand.name;

    return 'Embajadores / Creadores';
  }

  // Helper para extraer el color consistente de la marca
  public getBrandColor(brandName: string): string {
    const brand = this.BRAND_DICTIONARY.find(b => b.name === brandName);
    if (brand) return brand.color;

    // Si es "Embajadores / Creadores" u otra marca dinámica, asignamos un color basado en el nombre
    const hash = brandName.split('').reduce((acc, char) => char.charCodeAt(0) + acc, 0);
    return this.fallbackPalette[hash % this.fallbackPalette.length];
  }

  // Helper para obtener el logo de la marca
  public getBrandLogo(brandName: string): string {
    const brand = this.BRAND_DICTIONARY.find(b => b.name === brandName);
    return brand?.logoUrl || '/assets/logos/default-brand.svg';
  }

  // ==========================================
  // HELPERS INTERNOS
  // ==========================================

  private formatCompactNumber(value: number): string {
    if (!value || value === 0) return '0';
    if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
    if (value >= 1000) return (value / 1000).toFixed(1) + 'k';
    return String(value);
  }

  private extractDate(item: any): Date {
    const rawDate = item.timestamp || item.time || item.date || item.createTimeISO || item.createdAt || item.videoMeta?.createTime || item.createTime;
    if (item.createTime && typeof item.createTime === 'number') {
       return new Date(item.createTime < 10000000000 ? item.createTime * 1000 : item.createTime);
    }
    if (typeof rawDate === 'number' && rawDate < 10000000000) {
      return new Date(rawDate * 1000);
    }
    return rawDate ? new Date(rawDate) : new Date();
  }

  public getMetricValue(item: any, network: string, metric: ChartMetric): number {
    if (item._isPageProfile) {
      return 0;
    }

    const net = (network === 'omnicanal' ? item.__network : network) || item.__network || 'unknown';

    if (metric === 'views') {
      if (item._kpi?.postViews !== undefined) return item._kpi.postViews;
      if (net === 'instagram') return item.videoPlayCount || item.videoViewCount || item.playCount || item.viewsCount || 0;
      if (net === 'tiktok') return item.playCount || item.stats?.playCount || item.videoMeta?.playCount || 0;
      if (net === 'youtube') return item.viewCount || 0;
      if (net === 'facebook') return item.viewsCount || item.videoPostViewCount || item.views || 0;
      return item.viewsCount || item.viewCount || item.playCount || item.videoPostViewCount || 0;
    }

    if (metric === 'likes') {
      if (item._kpi?.postLikes !== undefined) return item._kpi.postLikes;
      if (net === 'tiktok') return item.diggCount || item.stats?.diggCount || item.videoMeta?.diggCount || 0;
      if (net === 'facebook') {
        // En Facebook los likes de post son reactionLikeCount, reactionsCount o postLikes.
        // NUNCA tomar item.likes si es un perfil de página o carece de postId.
        return item.reactionLikeCount || item.reactionsCount || item.postLikes || (item.postId ? item.likes : 0) || 0;
      }
      if (net === 'youtube') return item.likes || item.likeCount || 0;
      return item.likesCount || item.likes || item.diggCount || 0;
    }

    if (metric === 'comments') {
      if (net === 'tiktok') return item.commentCount || item.stats?.commentCount || item.videoMeta?.commentCount || item.commentsCount || 0;
      return item.commentsCount || item.commentCount || item.comments || 0;
    }

    // Métrica para Total (Interacciones = Likes + Comentarios + Shares)
    const likes = this.getMetricValue(item, net, 'likes');
    const comments = this.getMetricValue(item, net, 'comments');
    let shares = 0;

    if (net === 'tiktok') {
      shares = item.shareCount || item.stats?.shareCount || item.videoMeta?.shareCount || 0;
    } else if (net === 'facebook') {
      shares = item.sharesCount || item.shareCount || item.shares || 0;
    } else if (net === 'instagram') {
      shares = item.sharesCount || item.shareCount || 0;
    }

    return likes + comments + shares;
  }

  public hexToRgba(hex: string, alpha: number): string {
    if (!hex) return `rgba(99, 102, 241, ${alpha})`;
    let c = hex.replace('#', '');
    if (c.length === 3) {
      c = c.split('').map(x => x + x).join('');
    }
    const num = parseInt(c, 16);
    if (isNaN(num)) return `rgba(99, 102, 241, ${alpha})`;
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  private getMetricLabel(metric: ChartMetric): string {
    const labels: Record<ChartMetric, string> = {
      'total': 'Engagement (Interacciones Totales)',
      'views': 'Vistas / Reproducciones',
      'likes': 'Me Gusta (Likes)',
      'comments': 'Comentarios'
    };
    return labels[metric];
  }

  // ==========================================
  // GRÁFICOS
  // ==========================================

  buildChartOptions(network: string, rawData: any[], metric: ChartMetric = 'total'): EChartsOption {
    const metricName = this.getMetricLabel(metric);
    const dates = rawData.map(i => this.extractDate(i)).filter(d => !isNaN(d.getTime()));

    if (dates.length === 0) return {};

    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    const diffDays = (maxDate.getTime() - minDate.getTime()) / (1000 * 3600 * 24);

    const isDaily = diffDays <= 60;

    const getFormatKey = (d: Date) => {
      return isDaily
        ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
        : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    };

    const uniqueTimeKeys = Array.from(new Set(dates.map(d => getFormatKey(d)))).sort();

    const xAxisLabels = uniqueTimeKeys.map(key => {
      if (isDaily) {
        const [y,m,d] = key.split('-');
        return `${d} ${new Date(parseInt(y), parseInt(m)-1).toLocaleDateString('es-ES', {month: 'short'})}`;
      } else {
        const [y,m] = key.split('-');
        return new Date(parseInt(y), parseInt(m)-1).toLocaleDateString('es-ES', {month: 'short', year: 'numeric'});
      }
    });

    const groupedData: Record<string, Record<string, number>> = {};

    rawData.forEach(item => {
      if (item._isPageProfile) return;
      const authorName = this.getNormalizedBrandName(item);
      if (authorName === 'Embajadores / Creadores' || authorName === 'Medios y Eventos B2B') return;

      const timeKey = getFormatKey(this.extractDate(item));
      const value = this.getMetricValue(item, network, metric);

      if (!groupedData[authorName]) {
        groupedData[authorName] = {};
        uniqueTimeKeys.forEach(k => groupedData[authorName][k] = 0);
      }
      if(groupedData[authorName][timeKey] !== undefined) {
         groupedData[authorName][timeKey] += value;
      }
    });

    const seriesConfig: any[] = [];
    const legendData: string[] = Object.keys(groupedData);

    Object.entries(groupedData).forEach(([author, timeData]) => {
      const seriesData = uniqueTimeKeys.map(key => timeData[key]);
      const brandColor = this.getBrandColor(author);

      seriesConfig.push({
        name: author,
        type: 'line',
        smooth: 0.38,
        symbol: 'circle',
        symbolSize: 6,
        showSymbol: uniqueTimeKeys.length <= 15,
        lineStyle: {
          width: 2.8,
          shadowColor: this.hexToRgba(brandColor, 0.25),
          shadowBlur: 6
        },
        itemStyle: {
          color: brandColor,
          borderColor: '#ffffff',
          borderWidth: 2
        },
        areaStyle: {
          opacity: 0.9,
          color: {
            type: 'linear' as const,
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: this.hexToRgba(brandColor, 0.32) },
              { offset: 0.8, color: this.hexToRgba(brandColor, 0.04) },
              { offset: 1, color: this.hexToRgba(brandColor, 0.0) }
            ]
          }
        },
        emphasis: {
          scale: true,
          focus: 'series',
          itemStyle: {
            borderWidth: 2.5,
            borderColor: '#ffffff',
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.25)'
          }
        },
        data: seriesData,
        animationDuration: 1200,
        animationEasing: 'cubicOut'
      });
    });

    const isOmni = network === 'omnicanal';
    const mainTitle = isOmni ? `Evolución Omnicanal: ${metricName}` : `Evolución: ${metricName}`;
    const subTitle = isOmni ? `Tendencia de crecimiento consolidada en todas las plataformas` : `Tendencia de crecimiento por ${isDaily ? 'día' : 'mes'}`;

    return {
      title: {
        text: mainTitle,
        subtext: subTitle,
        textStyle: { fontFamily: 'Inter', fontSize: 16, color: '#0f172a', fontWeight: 600 },
        subtextStyle: { fontFamily: 'Inter', fontSize: 12, color: '#64748b' }
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        padding: [12, 14],
        extraCssText: 'box-shadow: 0 12px 28px -4px rgba(15, 23, 42, 0.12); border-radius: 12px; backdrop-filter: blur(8px);',
        textStyle: { fontFamily: 'Inter', color: '#1e293b' },
        axisPointer: {
          type: 'line',
          lineStyle: { color: '#94a3b8', width: 1.5, type: 'dashed' }
        },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const dateLabel = params[0].axisValue;
          const sorted = [...params].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
          let content = `
            <div style="font-family: Inter, sans-serif; min-width: 220px;">
              <div style="font-weight: 700; color: #0f172a; font-size: 13px; margin-bottom: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 5px;">
                ${dateLabel} • ${metricName}
              </div>
          `;
          sorted.forEach(p => {
            const val = Number(p.value) || 0;
            content += `
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 5px; font-size: 12px;">
                <div style="display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px;">
                  <span style="display:inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${p.color}; flex-shrink: 0;"></span>
                  <span style="color: #475569; font-weight: 500;">${p.seriesName}</span>
                </div>
                <strong style="color: #0f172a; font-variant-numeric: tabular-nums;">${val.toLocaleString()}</strong>
              </div>
            `;
          });
          content += `</div>`;
          return content;
        }
      },
      legend: {
        data: legendData,
        top: 60,
        textStyle: { fontFamily: 'Inter', fontSize: 11, color: '#475569' },
        itemGap: 16
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: uniqueTimeKeys.length > 7 ? 48 : 28,
        top: 115,
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: xAxisLabels,
        axisLine: { lineStyle: { color: '#cbd5e1' } },
        axisLabel: { fontFamily: 'Inter', color: '#64748b', fontSize: 11 }
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } },
        axisLabel: { fontFamily: 'Inter', color: '#64748b', fontSize: 11, formatter: (val: number) => this.formatCompactNumber(val) }
      },
      dataZoom: [
        {
          type: 'inside',
          start: 0,
          end: 100,
          zoomOnMouseWheel: true
        },
        {
          type: 'slider',
          show: uniqueTimeKeys.length > 7,
          bottom: 6,
          height: 18,
          borderColor: 'transparent',
          backgroundColor: 'rgba(241, 245, 249, 0.75)',
          fillerColor: 'rgba(99, 102, 241, 0.16)',
          handleStyle: { color: '#6366f1', borderColor: '#ffffff', shadowBlur: 3, shadowColor: 'rgba(0,0,0,0.15)' },
          textStyle: { fontFamily: 'Inter', fontSize: 10, color: '#64748b' }
        }
      ],
      series: seriesConfig
    };
  }

  buildMarketShareChart(network: string, rawData: any[], metric: ChartMetric = 'total'): EChartsOption {
    const aggregatedData: Record<string, number> = {};
    const metricName = this.getMetricLabel(metric);

    let hasData = false;

    rawData.forEach(item => {
      if (item._isPageProfile) return;
      const authorName = this.getNormalizedBrandName(item);
      if (authorName === 'Embajadores / Creadores' || authorName === 'Medios y Eventos B2B') return;

      const value = this.getMetricValue(item, network, metric);
      if (!aggregatedData[authorName]) aggregatedData[authorName] = 0;
      aggregatedData[authorName] += value;
      if (value > 0) hasData = true;
    });

    if (!hasData) {
      return {
        title: {
          text: 'Cuota de Mercado (Market Share)',
          subtext: `No hay datos de ${metricName}`,
          left: 'center',
          top: 4,
          itemGap: 6,
          textStyle: { fontFamily: 'Inter', fontSize: 15.5, color: '#0f172a', fontWeight: 600 },
          subtextStyle: { fontFamily: 'Inter', fontSize: 11.5, color: '#64748b' }
        },
        series: [{
          name: 'Sin datos',
          type: 'pie',
          radius: ['34%', '52%'],
          center: ['50%', '52%'],
          itemStyle: { color: '#e2e8f0' },
          label: { show: false },
          data: [{ name: 'Sin registros', value: 1 }]
        }]
      };
    }

    const pieData = Object.entries(aggregatedData)
      .map(([name, value]) => ({
        name,
        value,
        itemStyle: {
          color: this.getBrandColor(name),
          borderRadius: 6,
          borderColor: '#ffffff',
          borderWidth: 2.5
        }
      }));

    const isOmni = network === 'omnicanal';
    const mainTitle = isOmni ? 'Cuota de Mercado Omnicanal' : 'Cuota de Mercado';

    return {
      title: {
        text: mainTitle,
        subtext: `Distribución porcentual basada en ${metricName}`,
        left: 'center',
        top: 2,
        itemGap: 4,
        textStyle: { fontFamily: 'Inter', fontSize: 15.5, color: '#0f172a', fontWeight: 700 },
        subtextStyle: { fontFamily: 'Inter', fontSize: 11.5, color: '#64748b' }
      },
      tooltip: {
        trigger: 'item',
        confine: true,
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        padding: [10, 14],
        extraCssText: 'box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.12); border-radius: 12px; backdrop-filter: blur(8px);',
        formatter: (p: any) => `
          <div style="font-family: Inter, sans-serif; min-width: 170px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              <span style="display:inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${p.color};"></span>
              <strong style="color: #0f172a; font-size: 13px;">${p.name}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 12px; font-size: 12px; color: #64748b; margin-bottom: 3px;">
              <span>Cuota de Mercado:</span>
              <strong style="color: #0f172a; font-size: 13px;">${p.percent}%</strong>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 12px; font-size: 11px; color: #94a3b8;">
              <span>Volumen:</span>
              <span style="font-variant-numeric: tabular-nums; font-weight: 600; color: #475569;">${Number(p.value).toLocaleString()}</span>
            </div>
          </div>
        `
      },
      legend: {
        orient: 'horizontal',
        bottom: 8,
        left: 'center',
        icon: 'circle',
        itemWidth: 8,
        itemHeight: 8,
        itemGap: 12,
        padding: [0, 12],
        textStyle: { fontFamily: 'Inter', fontSize: 10.5, color: '#475569' }
      },
      series: [
        {
          name: metricName,
          type: 'pie',
          radius: ['34%', '52%'],
          center: ['50%', '52%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 6,
            borderColor: '#ffffff',
            borderWidth: 2.5,
            shadowBlur: 6,
            shadowColor: 'rgba(0, 0, 0, 0.04)'
          },
          emphasis: {
            scale: true,
            scaleSize: 6,
            itemStyle: {
              shadowBlur: 12,
              shadowColor: 'rgba(0, 0, 0, 0.15)'
            }
          },
          label: {
            show: true,
            formatter: '{b}\n{d}%',
            fontWeight: 600,
            fontFamily: 'Inter',
            fontSize: 10,
            color: '#334155',
            lineHeight: 13,
            minMargin: 4
          },
          labelLayout: {
            hideOverlap: true,
            moveOverlap: 'shiftY'
          },
          labelLine: {
            show: true,
            smooth: 0.2,
            length: 8,
            length2: 10,
            lineStyle: { color: '#cbd5e1' }
          },
          data: pieData
        }
      ]
    };
  }

  buildPerformanceScatterChart(network: string, rawData: any[]): EChartsOption {
    const groupedData: Record<string, any[]> = {};

    rawData.forEach(item => {
      if (item._isPageProfile) return;
      const authorName = this.getNormalizedBrandName(item);
      if (!groupedData[authorName]) groupedData[authorName] = [];
      groupedData[authorName].push(item);
    });

    const seriesConfig: any[] = [];
    const legendData: string[] = Object.keys(groupedData);

    Object.entries(groupedData).forEach(([author, items]) => {
      const brandColor = this.getBrandColor(author);
      const seriesData = items.map(i => {
        const views = this.getMetricValue(i, network, 'views');
        const engagement = this.getMetricValue(i, network, 'total');
        const comments = this.getMetricValue(i, network, 'comments') || 5;
        return { value: [views, engagement, comments], meta: i };
      });

      seriesConfig.push({
        name: author,
        type: 'scatter',
        symbolSize: (data: any) => Math.min(Math.max(data[2] * 2, 14), 48),
        data: seriesData,
        itemStyle: {
          color: brandColor,
          opacity: 0.72,
          borderColor: '#ffffff',
          borderWidth: 1.5,
          shadowBlur: 8,
          shadowColor: this.hexToRgba(brandColor, 0.3)
        },
        emphasis: {
          scale: true,
          itemStyle: {
            opacity: 1,
            shadowBlur: 14,
            shadowColor: this.hexToRgba(brandColor, 0.5)
          }
        }
      });
    });

    return {
      title: {
        text: 'Cuadrante de Calidad de Contenido',
        subtext: 'Eje X: Vistas (Alcance) | Eje Y: Interacciones | Tamaño de Burbuja: Comentarios',
        textStyle: { fontFamily: 'Inter', fontSize: 16, color: '#0f172a', fontWeight: 600 },
        subtextStyle: { fontFamily: 'Inter', fontSize: 12, color: '#64748b' }
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        padding: 12,
        extraCssText: 'box-shadow: 0 12px 28px -4px rgba(15, 23, 42, 0.14); border-radius: 12px; backdrop-filter: blur(8px);',
        formatter: (params: any) => {
          const meta = params.data.meta;
          const title = meta.caption || meta.title || meta.text || 'Contenido visual';
          const shortTitle = title.length > 60 ? title.substring(0, 60) + '...' : title;
          return `
            <div style="max-width: 290px; white-space: normal; font-family: Inter, sans-serif;">
              <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                <span style="display:inline-block; width: 9px; height: 9px; border-radius: 50%; background: ${params.color};"></span>
                <strong style="color: #0f172a; font-size: 13px;">${params.seriesName}</strong>
              </div>
              <p style="font-size: 11px; color: #64748b; margin: 4px 0 8px 0; font-style: italic; line-height: 1.4;">"${shortTitle}"</p>
              <hr style="margin: 6px 0; border: 0; border-top: 1px solid #f1f5f9;" />
              <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px; color: #475569;">
                <span>Vistas (Alcance):</span>
                <strong style="color: #0f172a; font-variant-numeric: tabular-nums;">${params.value[0].toLocaleString()}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px; color: #475569;">
                <span>Engagement Total:</span>
                <strong style="color: #0f172a; font-variant-numeric: tabular-nums;">${params.value[1].toLocaleString()}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 11px; color: #475569;">
                <span>Comentarios:</span>
                <strong style="color: #0f172a; font-variant-numeric: tabular-nums;">${params.value[2].toLocaleString()}</strong>
              </div>
            </div>
          `;
        }
      },
      legend: {
        data: legendData,
        top: 60,
        icon: 'circle',
        itemGap: 14,
        textStyle: { fontFamily: 'Inter', fontSize: 11, color: '#475569' }
      },
      grid: { left: '5%', right: '6%', bottom: '10%', top: 115, containLabel: true },
      xAxis: {
        type: 'value',
        name: 'Vistas (Alcance)',
        nameLocation: 'middle',
        nameGap: 28,
        nameTextStyle: { fontFamily: 'Inter', color: '#64748b', fontSize: 11 },
        splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } },
        axisLabel: { fontFamily: 'Inter', color: '#64748b', fontSize: 11, formatter: (val: number) => this.formatCompactNumber(val) }
      },
      yAxis: {
        type: 'value',
        name: 'Engagement Total',
        nameTextStyle: { fontFamily: 'Inter', color: '#64748b', fontSize: 11 },
        splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } },
        axisLabel: { fontFamily: 'Inter', color: '#64748b', fontSize: 11, formatter: (val: number) => this.formatCompactNumber(val) }
      },
      series: seriesConfig
    };
  }

  buildMasterOmnichannelChart(aggregatedData: any[], metric: ChartMetric = 'total'): EChartsOption {
    const metricName = this.getMetricLabel(metric);
    const networks = ['facebook', 'instagram', 'tiktok', 'youtube'];
    const displayNetworks = ['Facebook', 'Instagram', 'TikTok', 'YouTube'];

    const brandNetworkMap: Record<string, Record<string, number>> = {};

    aggregatedData.forEach(item => {
       if (item._isPageProfile) return;
       const authorName = this.getNormalizedBrandName(item);
       if (authorName === 'Embajadores / Creadores' || authorName === 'Medios y Eventos B2B') return;

       const net = item.__network || 'unknown';
       const val = this.getMetricValue(item, net, metric);

       if (!brandNetworkMap[authorName]) {
         brandNetworkMap[authorName] = { facebook: 0, instagram: 0, tiktok: 0, youtube: 0 };
       }
       if (networks.includes(net)) {
         brandNetworkMap[authorName][net] += val;
       }
    });

    const seriesConfig: any[] = [];
    const legendData = Object.keys(brandNetworkMap);

    Object.entries(brandNetworkMap).forEach(([brand, netData]) => {
       const brandColor = this.getBrandColor(brand);
       seriesConfig.push({
         name: brand,
         type: 'bar',
         barMaxWidth: 32,
         data: networks.map(n => netData[n]),
         itemStyle: {
           color: {
             type: 'linear' as const,
             x: 0, y: 0, x2: 0, y2: 1,
             colorStops: [
               { offset: 0, color: brandColor },
               { offset: 1, color: this.hexToRgba(brandColor, 0.76) }
             ]
           },
           borderRadius: [6, 6, 0, 0],
           shadowBlur: 4,
           shadowColor: 'rgba(0, 0, 0, 0.04)'
         },
         emphasis: {
           itemStyle: {
             shadowBlur: 10,
             shadowColor: this.hexToRgba(brandColor, 0.3)
           }
         },
         label: {
           show: true,
           position: 'top',
           fontFamily: 'Inter',
           fontSize: 10,
           color: '#64748b',
           formatter: (p: any) => p.value > 0 ? this.formatCompactNumber(p.value) : ''
         }
       });
    });

    return {
      title: {
        text: `Share of Voice Omnicanal`,
        subtext: `Comparativa de ${metricName} en todo el Ecosistema Digital`,
        textStyle: { fontFamily: 'Inter', fontSize: 16, color: '#0f172a', fontWeight: 600 },
        subtextStyle: { fontFamily: 'Inter', fontSize: 12, color: '#64748b' }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
          shadowStyle: { color: 'rgba(99, 102, 241, 0.06)' }
        },
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        padding: [12, 14],
        extraCssText: 'box-shadow: 0 12px 28px -4px rgba(15, 23, 42, 0.12); border-radius: 12px; backdrop-filter: blur(8px);',
        textStyle: { fontFamily: 'Inter', color: '#1e293b' }
      },
      legend: {
        data: legendData,
        top: 60,
        icon: 'circle',
        itemGap: 14,
        textStyle: { fontFamily: 'Inter', fontSize: 11, color: '#475569' }
      },
      grid: { left: '3%', right: '4%', bottom: '5%', top: 115, containLabel: true },
      xAxis: {
        type: 'category',
        data: displayNetworks,
        axisLine: { lineStyle: { color: '#cbd5e1' } },
        axisLabel: { fontFamily: 'Inter', fontWeight: 600, color: '#334155' }
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } },
        axisLabel: { fontFamily: 'Inter', color: '#64748b', fontSize: 11, formatter: (val: number) => this.formatCompactNumber(val) }
      },
      series: seriesConfig
    };
  }

  buildEngagementRateChart(network: string, rawData: any[]): EChartsOption {
    const brandMap: Record<string, { posts: number; totalInteractions: number; totalViews: number; likes: number; comments: number }> = {};

    rawData.forEach(item => {
      if (item._isPageProfile) return;
      const authorName = this.getNormalizedBrandName(item);
      if (authorName === 'Embajadores / Creadores' || authorName === 'Medios y Eventos B2B') return;

      const net = (network === 'omnicanal' ? item.__network : network) || item.__network || 'unknown';
      const views = this.getMetricValue(item, net, 'views');
      const likes = this.getMetricValue(item, net, 'likes');
      const comments = this.getMetricValue(item, net, 'comments');
      const interactions = this.getMetricValue(item, net, 'total');

      if (!brandMap[authorName]) {
        brandMap[authorName] = { posts: 0, totalInteractions: 0, totalViews: 0, likes: 0, comments: 0 };
      }
      brandMap[authorName].posts += 1;
      brandMap[authorName].totalInteractions += interactions;
      brandMap[authorName].totalViews += views;
      brandMap[authorName].likes += likes;
      brandMap[authorName].comments += comments;
    });

    const brands = Object.keys(brandMap);
    if (brands.length === 0) return {};

    // Ordenar marcas por promedio de interacciones descendente
    brands.sort((a, b) => {
      const avgA = brandMap[a].posts ? brandMap[a].totalInteractions / brandMap[a].posts : 0;
      const avgB = brandMap[b].posts ? brandMap[b].totalInteractions / brandMap[b].posts : 0;
      return avgB - avgA;
    });

    const avgInteractionsData = brands.map(b => {
      const d = brandMap[b];
      const avg = d.posts ? Math.round(d.totalInteractions / d.posts) : 0;
      const brandColor = this.getBrandColor(b);
      return {
        value: avg,
        itemStyle: {
          color: {
            type: 'linear' as const,
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: brandColor },
              { offset: 1, color: this.hexToRgba(brandColor, 0.75) }
            ]
          },
          borderRadius: [6, 6, 0, 0]
        },
        meta: d
      };
    });

    // Fórmula oficial ejecutiva acordada: ER = (Interacciones Totales / Vistas) * 100
    const erData = brands.map(b => {
      const d = brandMap[b];
      let rate = 0;
      if (d.totalViews > 0) {
        rate = Number(((d.totalInteractions / d.totalViews) * 100).toFixed(2));
      }
      return rate;
    });

    return {
      title: {
        text: 'Engagement Rate y Promedio de Interacciones por Competidor',
        subtext: 'Barras agrupadas: Promedio Interacciones/Post (color marca) vs Tasa Engagement % sobre vistas (púrpura)',
        textStyle: { fontFamily: 'Inter', fontSize: 16, color: '#0f172a', fontWeight: 600 },
        subtextStyle: { fontFamily: 'Inter', fontSize: 12, color: '#64748b' }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
          shadowStyle: { color: 'rgba(99, 102, 241, 0.05)' }
        },
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        padding: 12,
        extraCssText: 'box-shadow: 0 12px 28px -4px rgba(15, 23, 42, 0.14); border-radius: 12px; backdrop-filter: blur(8px);',
        textStyle: { fontFamily: 'Inter', color: '#1e293b' },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const brand = params[0].name;
          const d = brandMap[brand];
          if (!d) return '';
          const avg = d.posts ? Math.round(d.totalInteractions / d.posts) : 0;
          const er = erData[brands.indexOf(brand)];
          const brandColor = this.getBrandColor(brand);
          return `
            <div style="min-width: 230px; font-family: Inter, sans-serif;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span style="display:inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: ${brandColor};"></span>
                <strong style="color: #0f172a; font-size: 14px;">${brand}</strong>
              </div>
              <div style="color: #64748b; font-size: 12px; margin-bottom: 6px;">
                Publicaciones analizadas: <b style="color: #1e293b;">${d.posts}</b>
              </div>
              <hr style="margin: 6px 0; border: 0; border-top: 1px solid #f1f5f9;" />
              <div style="display: flex; justify-content: space-between; gap: 12px; margin-bottom: 4px; font-size: 12px;">
                <span style="color: #475569;">📊 Prom. Interacciones / Post:</span>
                <b style="color: #2563eb; font-variant-numeric: tabular-nums;">${avg.toLocaleString()}</b>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 12px; margin-bottom: 4px; font-size: 12px;">
                <span style="color: #475569;">📈 Tasa de Engagement (ER s/ Vistas):</span>
                <b style="color: #8b5cf6; font-variant-numeric: tabular-nums;">${er}%</b>
              </div>
              <div style="font-size: 10px; color: #94a3b8; margin-top: 4px; margin-bottom: 4px;">
                Fórmula: (Interacciones / Vistas) × 100
              </div>
              <div style="display: flex; justify-content: space-between; gap: 12px; font-size: 11px; color: #94a3b8; margin-top: 4px;">
                <span>❤️ Likes: ${this.formatCompactNumber(d.likes)}</span>
                <span>💬 Comentarios: ${this.formatCompactNumber(d.comments)}</span>
              </div>
            </div>
          `;
        }
      },
      legend: {
        data: ['Promedio Interacciones / Post', 'Tasa Engagement (%)'],
        top: 60,
        icon: 'circle',
        itemGap: 14,
        textStyle: { fontFamily: 'Inter', fontSize: 12, color: '#475569' }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '8%',
        top: 115,
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: brands,
        axisLine: { lineStyle: { color: '#cbd5e1' } },
        axisLabel: {
          fontFamily: 'Inter',
          color: '#334155',
          interval: 0,
          rotate: brands.length > 5 ? 20 : 0
        },
        axisTick: { alignWithLabel: true }
      },
      yAxis: [
        {
          type: 'value',
          name: 'Interacciones / Post',
          nameTextStyle: { fontFamily: 'Inter', color: '#64748b', fontSize: 11 },
          axisLabel: {
            fontFamily: 'Inter',
            color: '#64748b',
            formatter: (val: number) => this.formatCompactNumber(val)
          },
          splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } }
        },
        {
          type: 'value',
          name: 'Engagement Rate (%)',
          nameTextStyle: { fontFamily: 'Inter', color: '#8b5cf6', fontSize: 11 },
          axisLabel: {
            fontFamily: 'Inter',
            color: '#8b5cf6',
            formatter: '{value}%'
          },
          splitLine: { show: false }
        }
      ],
      series: [
        {
          name: 'Promedio Interacciones / Post',
          type: 'bar',
          data: avgInteractionsData,
          yAxisIndex: 0,
          barGap: '20%',
          barMaxWidth: 28,
          label: {
            show: true,
            position: 'top',
            fontFamily: 'Inter',
            fontSize: 10,
            color: '#64748b',
            formatter: (p: any) => p.value > 0 ? this.formatCompactNumber(p.value) : ''
          }
        },
        {
          name: 'Tasa Engagement (%)',
          type: 'bar',
          yAxisIndex: 1,
          data: erData,
          barMaxWidth: 28,
          itemStyle: {
            color: {
              type: 'linear' as const,
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: '#8b5cf6' },
                { offset: 1, color: '#6d28d9' }
              ]
            },
            borderRadius: [6, 6, 0, 0]
          },
          label: {
            show: true,
            position: 'top',
            fontFamily: 'Inter',
            fontSize: 10,
            fontWeight: 'bold',
            color: '#7c3aed',
            formatter: '{c}%'
          }
        }
      ]
    };
  }

  buildContentTypePerformanceChart(network: string, rawData: any[]): EChartsOption {
    const formatMap: Record<string, { count: number; totalViews: number; totalInteractions: number }> = {
      video: { count: 0, totalViews: 0, totalInteractions: 0 },
      carousel: { count: 0, totalViews: 0, totalInteractions: 0 },
      image: { count: 0, totalViews: 0, totalInteractions: 0 },
      text: { count: 0, totalViews: 0, totalInteractions: 0 }
    };

    const formatLabels: Record<string, string> = {
      video: 'Reels / Videos',
      carousel: 'Carruseles',
      image: 'Fotos / Imágenes',
      text: 'Solo Texto'
    };

    rawData.forEach(item => {
      if (item._isPageProfile) return;
      let format = item._contentType;
      if (!format || !formatMap[format]) {
        if (item.videoUrl || item.playCount || item.viewsCount) format = 'video';
        else if (item.isSlideshow || (item.mediaUrls && item.mediaUrls.length > 1)) format = 'carousel';
        else if (item.imageUrl || (item.images && item.images.length > 0)) format = 'image';
        else format = 'text';
      }

      const net = (network === 'omnicanal' ? item.__network : network) || item.__network || 'unknown';
      const views = this.getMetricValue(item, net, 'views');
      const likes = this.getMetricValue(item, net, 'likes');
      const comments = this.getMetricValue(item, net, 'comments');
      const interactions = likes + comments > 0 ? likes + comments : this.getMetricValue(item, net, 'total');

      if (!formatMap[format]) {
        formatMap[format] = { count: 0, totalViews: 0, totalInteractions: 0 };
      }
      formatMap[format].count += 1;
      formatMap[format].totalViews += views;
      formatMap[format].totalInteractions += interactions;
    });

    const activeFormats = Object.keys(formatMap).filter(f => formatMap[f].count > 0);
    if (activeFormats.length === 0) return {};

    const categories = activeFormats.map(f => formatLabels[f] || f);
    const avgViews = activeFormats.map(f => {
      const d = formatMap[f];
      return d.count ? Math.round(d.totalViews / d.count) : 0;
    });
    const avgInteractions = activeFormats.map(f => {
      const d = formatMap[f];
      return d.count ? Math.round(d.totalInteractions / d.count) : 0;
    });

    return {
      title: {
        text: 'Efectividad por Formato de Contenido',
        subtext: 'Vistas promedio vs Interacciones promedio generadas por formato',
        textStyle: { fontFamily: 'Inter', fontSize: 16, color: '#0f172a', fontWeight: 600 },
        subtextStyle: { fontFamily: 'Inter', fontSize: 12, color: '#64748b' }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
          shadowStyle: { color: 'rgba(99, 102, 241, 0.05)' }
        },
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        padding: 12,
        extraCssText: 'box-shadow: 0 12px 28px -4px rgba(15, 23, 42, 0.12); border-radius: 12px; backdrop-filter: blur(8px);',
        textStyle: { fontFamily: 'Inter', color: '#1e293b' }
      },
      legend: {
        data: ['Vistas Promedio', 'Interacciones Promedio'],
        top: 60,
        icon: 'circle',
        itemGap: 14,
        textStyle: { fontFamily: 'Inter', fontSize: 12, color: '#475569' }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '8%',
        top: 115,
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: categories,
        axisLine: { lineStyle: { color: '#cbd5e1' } },
        axisLabel: { fontFamily: 'Inter', fontWeight: 600, color: '#334155' }
      },
      yAxis: [
        {
          type: 'value',
          name: 'Vistas Promedio',
          nameTextStyle: { fontFamily: 'Inter', color: '#64748b', fontSize: 11 },
          axisLabel: {
            fontFamily: 'Inter',
            color: '#64748b',
            formatter: (val: number) => this.formatCompactNumber(val)
          },
          splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } }
        },
        {
          type: 'value',
          name: 'Interacciones Promedio',
          nameTextStyle: { fontFamily: 'Inter', color: '#8b5cf6', fontSize: 11 },
          axisLabel: {
            fontFamily: 'Inter',
            color: '#8b5cf6',
            formatter: (val: number) => this.formatCompactNumber(val)
          },
          splitLine: { show: false }
        }
      ],
      series: [
        {
          name: 'Vistas Promedio',
          type: 'bar',
          yAxisIndex: 0,
          data: avgViews,
          itemStyle: {
            color: {
              type: 'linear' as const,
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: '#0ea5e9' },
                { offset: 1, color: '#0284c7' }
              ]
            },
            borderRadius: [6, 6, 0, 0]
          },
          barMaxWidth: 35,
          label: {
            show: true,
            position: 'top',
            fontFamily: 'Inter',
            fontSize: 10,
            color: '#64748b',
            formatter: (p: any) => p.value > 0 ? this.formatCompactNumber(p.value) : ''
          }
        },
        {
          name: 'Interacciones Promedio',
          type: 'bar',
          yAxisIndex: 1,
          data: avgInteractions,
          itemStyle: {
            color: {
              type: 'linear' as const,
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: '#a855f7' },
                { offset: 1, color: '#7c3aed' }
              ]
            },
            borderRadius: [6, 6, 0, 0]
          },
          barMaxWidth: 35,
          label: {
            show: true,
            position: 'top',
            fontFamily: 'Inter',
            fontSize: 10,
            color: '#64748b',
            formatter: (p: any) => p.value > 0 ? this.formatCompactNumber(p.value) : ''
          }
        }
      ]
    };
  }

  public getProxiedImageUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    const lower = url.toLowerCase();
    if (
      lower.includes('tiktokcdn') ||
      lower.includes('byteoversea') ||
      lower.includes('cdninstagram') ||
      lower.includes('fbcdn.net') ||
      lower.includes('instagram.com')
    ) {
      return `/api/proxy-image?url=${encodeURIComponent(url)}`;
    }
    return url;
  }

  public getBrandGradient(brandName: string): string {
    const color = this.getBrandColor(brandName);
    return `linear-gradient(135deg, #090d16 0%, #172033 55%, ${color}45 100%)`;
  }
}

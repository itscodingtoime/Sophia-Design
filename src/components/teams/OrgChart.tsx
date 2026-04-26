import { useEffect, useRef } from 'react';
import { OrgChart } from 'd3-org-chart';
import { C } from '../../theme';

import type { OrgChartNode } from '../../hooks/useAllTeamsOrgData';

type Props = {
  data: OrgChartNode[];
};

export default function TeamOrgChart({ data }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<OrgChart<OrgChartNode> | null>(null);

  useEffect(() => {
    if (!chartRef.current || data.length === 0) return;

    // Clear container before creating new chart
    if (chartRef.current) {
      chartRef.current.innerHTML = '';
    }
    chartInstance.current = null;

    chartInstance.current = new OrgChart<OrgChartNode>()
      .container(chartRef.current)
      .data(data)
      .nodeWidth((d: any) => {
        const nodeType = d.data?.type;
        if (nodeType === 'root') return 180;
        if (nodeType === 'team') return 200;
        return 240;
      })
      .nodeHeight((d: any) => {
        const nodeType = d.data?.type;
        if (nodeType === 'root') return 80;
        if (nodeType === 'team') return 70;
        return 80;
      })
      .childrenMargin(() => 50)
      .compactMarginBetween(() => 25)
      .compactMarginPair(() => 60)
      .nodeContent((d: any) => {
        const node = d.data as OrgChartNode;

        // ROOT (Organisation)
        if (node.type === 'root') {
          return `
            <div style="
              width: 100%; height: 100%;
              display: flex; flex-direction: column; align-items: center; justify-content: center;
              border-radius: 12px;
              background: linear-gradient(135deg, ${C.teal}, ${C.tealMuted});
              box-shadow: 0 10px 25px rgba(0,0,0,0.2);
              padding: 8px 12px;
            ">
              <div style="color: ${C.bg}; font-weight: bold; font-size: 14px; text-align: center;">
                ${node.name}
              </div>
              <div style="color: ${C.bg}; opacity: 0.8; font-size: 11px; margin-top: 2px;">
                ${node.role}
              </div>
            </div>
          `;
        }

        // TEAM
        if (node.type === 'team') {
          return `
            <div style="
              width: 100%; height: 100%;
              display: flex; flex-direction: column; align-items: center; justify-content: center;
              border-radius: 12px;
              background: ${C.tealDeep};
              border: 1px solid ${C.tealBorder};
              padding: 8px 12px;
            ">
              <div style="color: ${C.text}; font-weight: 600; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;">
                ${node.name.length > 16 ? node.name.slice(0, 16) + '...' : node.name}
              </div>

              <div style="
                margin-top: 4px;
                padding: 2px 12px;
                border-radius: 9999px;
                background: ${C.teal};
                color: ${C.bg};
                font-size: 10px;
                font-weight: 500;
              ">
                ${node.role}
              </div>
            </div>
          `;
        }

        // MEMBER
        const isAdmin = node.role === 'Admin';
        const initials =
          node.name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase() || '?';

        return `
          <div style="
            width: 100%; height: 100%;
            display: flex; align-items: center; gap: 8px;
            border-radius: 12px;
            background: ${C.elevated};
            padding: 8px 12px;
            border: 1px solid ${isAdmin ? C.tealBorder : C.border};
          ">
            ${
              node.imageUrl
                ? `
                  <img
                    src="${node.imageUrl}"
                    style="
                      width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0;
                      border: 1px solid ${isAdmin ? C.amber : C.border};
                    "
                  />
                `
                : `
                  <div style="
                    width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
                    display: flex; align-items: center; justify-content: center;
                    color: ${C.text}; font-size: 12px; font-weight: 600;
                    ${
                      isAdmin
                        ? 'background: linear-gradient(135deg, #f59e0b, #d97706);'
                        : `background: ${C.hoverBg};`
                    }
                  ">
                    ${initials}
                  </div>
                `
            }
            <div style="flex: 1; min-width: 0;">
              <div style="color: ${C.text}; font-weight: 600; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${node.name}
              </div>
              <div style="
                font-size: 10px; margin-top: 2px;
                color: ${isAdmin ? C.amber : C.textDim};
              ">
                ${isAdmin ? 'Admin' : 'Member'}
              </div>
            </div>
          </div>
        `;
      })
      .render();

    return () => {
      if (chartRef.current) {
        chartRef.current.innerHTML = '';
      }
      chartInstance.current = null;
    };
  }, [data]);

  return <div ref={chartRef} className="w-full min-h-[600px]" style={{ background: C.bgSub }} />;
}

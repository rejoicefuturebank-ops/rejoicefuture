// Admin Audit Logs Module
const AdminAudit = {
    logs: [],

    init() {
        this.loadLogs();
        this.setupFilters();
    },

    setupFilters() {
        document.getElementById('filterAuditBtn')?.addEventListener('click', () => {
            const action = document.getElementById('auditActionFilter').value;
            this.loadLogs({ action });
        });

        document.getElementById('exportAuditBtn')?.addEventListener('click', () => {
            this.exportCSV();
        });
    },

    async loadLogs(params = {}) {
        try {
            const response = await API.admin.getAuditLogs(params);
            this.logs = response.logs || [];
            this.render();
        } catch (error) {
            console.error('Audit load error:', error);
        }
    },

    render() {
        const tbody = document.getElementById('auditLogsBody');
        if (!tbody) return;

        if (this.logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">No audit logs found</td></tr>';
            return;
        }

        tbody.innerHTML = this.logs.map(log => `
            <tr>
                <td>${Utils.formatDateTime(log.created_at)}</td>
                <td>${log.actor_type} (${log.actor_id?.slice(0, 8)}...)</td>
                <td><span class="badge badge-info">${log.action}</span></td>
                <td>${log.target_type || '—'} ${log.target_id ? `(${log.target_id.slice(0, 8)}...)` : ''}</td>
                <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis">
                    ${log.reason || ''}
                    ${log.reference ? `<br><code>${log.reference}</code>` : ''}
                </td>
                <td>${log.ip_address || '—'}</td>
            </tr>
        `).join('');
    },

    exportCSV() {
        const csv = [
            'Timestamp,Actor,Action,Target,Reason,IP',
            ...this.logs.map(l =>
                `${l.created_at},${l.actor_type},${l.action},${l.target_type || ''},"${l.reason || ''}",${l.ip_address || ''}`
            )
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
    }
};
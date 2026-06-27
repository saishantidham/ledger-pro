const DB = {
    async fetchFlats() {
        const { data, error } = await supabaseClient
            .from('flats')
            .select('*')
            .order('flat_no');
        if (error) console.error("Error fetching flats:", error);
        return data || [];
    },

    async updateFlatMaster(flatNo, updates) {
        const { error } = await supabaseClient
            .from('flats')
            .update(updates)
            .eq('flat_no', flatNo);
        if (error) console.error("Error updating flat:", error);
        return !error;
    },

    async getTodayStats() {
        // We will implement the aggregation logic later for the dashboard
    }
};

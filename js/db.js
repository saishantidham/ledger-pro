const DB = {
    async fetchFlats() {
        const { data, error } = await supabaseClient
            .from('flats')
            .select('*')
            .order('flat_no');
            
        if (error) {
            console.error("Error fetching flats:", error);
            return [];
        }
        return data;
    },

    async insertReceipt(receiptData) {
        const { data, error } = await supabaseClient
            .from('receipts')
            .insert([receiptData])
            .select();
            
        if (error) {
            console.error("Error inserting receipt:", error);
            throw error;
        }
        return data[0];
    },

    async updateFlatMaster(flatNo, updates) {
        const { data, error } = await supabaseClient
            .from('flats')
            .update(updates)
            .eq('flat_no', flatNo)
            .select();
            
        if (error) {
            console.error("Error updating flat:", error);
            throw error;
        }
        return data[0];
    },

    async fetchReceiptsByDate(startDate, endDate) {
        // Simplified query: Fetching just the receipts. No complex joins required.
        const { data, error } = await supabaseClient
            .from('receipts')
            .select('*')
            .gte('date', startDate)
            .lte('date', endDate)
            .order('flat_no', { ascending: true })
            .order('date', { ascending: true });
            
        if (error) {
            console.error("Error fetching dated receipts:", error);
            throw error;
        }
        return data;
    }
};

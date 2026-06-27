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
    }
};

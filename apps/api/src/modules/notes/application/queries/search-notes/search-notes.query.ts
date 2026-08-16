export class SearchNotesQuery {
  constructor(
    public readonly userId: string,
    public readonly queryText?: string,
    public readonly labels?: string[],
    public readonly accessMode?: 'owner' | 'shared' | 'all',
    public readonly from?: number,
    public readonly size?: number,
  ) {}
}

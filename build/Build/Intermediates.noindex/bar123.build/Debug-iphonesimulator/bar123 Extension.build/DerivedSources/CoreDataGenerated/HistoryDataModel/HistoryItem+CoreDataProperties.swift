//
//  HistoryItem+CoreDataProperties.swift
//  
//
//  Created by alex newman on 6/14/25.
//
//  This file was automatically generated and should not be edited.
//

import Foundation
import CoreData


extension HistoryItem {

    @nonobjc public class func fetchRequest() -> NSFetchRequest<HistoryItem> {
        return NSFetchRequest<HistoryItem>(entityName: "HistoryItem")
    }

    @NSManaged public var id: String?
    @NSManaged public var isSynced: Bool
    @NSManaged public var syncedAt: Date?
    @NSManaged public var title: String?
    @NSManaged public var url: String?
    @NSManaged public var visitTime: Date?

}

extension HistoryItem : Identifiable {

}
